import { env } from '../config/env.js';
import type { GeminiAssessment, OcrExtractionResult, RedacaoJobData, WorkerRagIssue } from './types.js';
import { analisarTexto } from './text-analysis.js';

function createTimeoutSignal(timeoutMs: number): { signal: AbortSignal; clear: () => void } {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    return {
        signal: controller.signal,
        clear: () => clearTimeout(timeoutId),
    };
}

async function fetchJson<T>(url: string, init: RequestInit, timeoutMs: number): Promise<T> {
    const { signal, clear } = createTimeoutSignal(timeoutMs);

    try {
        const response = await fetch(url, { ...init, signal });

        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            throw new Error(`Resposta inválida de ${url}: ${response.status} ${errorBody}`);
        }

        return (await response.json()) as T;
    } finally {
        clear();
    }
}

function base64ToBlob(imageBase64: string, fallbackName = 'image.png'): Blob {
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '').trim();
    const buffer = Buffer.from(cleanBase64, 'base64');
    return new Blob([buffer], { type: fallbackName.endsWith('.jpg') || fallbackName.endsWith('.jpeg') ? 'image/jpeg' : 'image/png' });
}

export async function extrairTextoOCR(jobData: RedacaoJobData): Promise<OcrExtractionResult | null> {
    const imageBase64 = jobData.imageBase64?.trim();
    const imageUrl = jobData.imageUrl?.trim();

    if (!imageBase64 && !imageUrl) {
        return null;
    }

    if (!env.ocrServiceUrl) {
        return {
            used: false,
            method: 'fallback',
            confidence: 0,
            processingTime: 0,
            wordCount: 0,
            text: jobData.textoRedacao || '',
            note: 'OCR não configurado; usando texto já enviado no job.',
        };
    }

    const startTime = Date.now();
    const formData = new FormData();

    if (imageBase64) {
        formData.append('file', base64ToBlob(imageBase64, 'image.png'), 'image.png');
    } else if (imageUrl) {
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            throw new Error(`Falha ao baixar imagem para OCR: ${imageResponse.status}`);
        }

        const arrayBuffer = await imageResponse.arrayBuffer();
        const contentType = imageResponse.headers.get('content-type') || 'image/png';
        formData.append('file', new Blob([arrayBuffer], { type: contentType }), 'image.png');
    }

    formData.append('organize_enem', 'true');

    const response = await fetch(env.ocrServiceUrl, {
        method: 'POST',
        headers: env.ocrApiKey ? { 'X-API-Key': env.ocrApiKey } : undefined,
        body: formData,
    });

    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`OCR externo retornou ${response.status}: ${errorBody}`);
    }

    const payload = (await response.json()) as {
        text?: string;
        stats?: {
            final_confidence?: number;
            ocr_confidence?: number;
            words_extracted?: number;
        };
    };
    const text = String(payload.text || '').trim();

    return {
        used: true,
        method: 'redaline-ocr',
        confidence: Number(payload.stats?.final_confidence ?? payload.stats?.ocr_confidence ?? 0),
        processingTime: (Date.now() - startTime) / 1000,
        wordCount: Number(payload.stats?.words_extracted ?? text.split(/\s+/).filter(Boolean).length),
        text,
    };
}

export async function analisarComGemini(
    jobData: RedacaoJobData,
    textoProcessado: string
): Promise<GeminiAssessment | null> {
    if (!env.enableGeminiAnalysis || !env.geminiApiKey) {
        return null;
    }

    const analysis = analisarTexto(textoProcessado);
    const prompt = [
        'Você é um corretor de redações ENEM. Analise o texto e responda APENAS em JSON válido.',
        'Campos obrigatórios:',
        '{',
        '  "summary": string,',
        '  "score": { "c1": number, "c2": number, "c3": number, "c4": number, "c5": number, "total": number },',
        '  "strengths": string[],',
        '  "weaknesses": string[],',
        '  "suggestions": string[]',
        '}',
        '',
        `Título: ${jobData.titulo || 'Redação sem título'}`,
        `Tema: ${jobData.tema || analysis.temaIdentificado || 'Tema não especificado'}`,
        jobData.proposalSheetText ? `Folha-proposta: ${jobData.proposalSheetText}` : '',
        '',
        'Texto:',
        textoProcessado,
    ].filter(Boolean).join('\n');

    const model = env.geminiModel;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.geminiApiKey}`;
    const payload = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
        },
    };

    const response = await fetchJson<{ candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }>(
        endpoint,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        },
        env.requestTimeoutMs
    );

    const rawText = response.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim() || '';
    if (!rawText) {
        return null;
    }

    try {
        const parsed = JSON.parse(rawText) as Partial<GeminiAssessment>;
        const score = parsed.score || {} as GeminiAssessment['score'];

        return {
            summary: String(parsed.summary || 'Análise concluída.'),
            score: {
                c1: Number(score.c1 || 0),
                c2: Number(score.c2 || 0),
                c3: Number(score.c3 || 0),
                c4: Number(score.c4 || 0),
                c5: Number(score.c5 || 0),
                total: Number(score.total || 0),
            },
            strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
            weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.map(String) : [],
            suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String) : [],
            model,
        };
    } catch {
        return null;
    }
}

export async function buscarIssuesRag(textoProcessado: string, proposalSheetText?: string | null): Promise<WorkerRagIssue[]> {
    if (!env.enableRagReview || !env.ragReviewUrl) {
        return [];
    }

    const payload = {
        essay: textoProcessado,
        proposalSheetText: proposalSheetText || null,
    };

    const issues = await fetchJson<unknown>(
        env.ragReviewUrl,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        },
        env.requestTimeoutMs
    );

    if (!Array.isArray(issues)) {
        return [];
    }

    return issues
        .map((issue) => {
            if (!issue || typeof issue !== 'object') {
                return null;
            }

            const item = issue as Record<string, unknown>;
            const comentario = String(item.comentario || item.teacher_feedback || '').trim();
            const trecho = String(item.trecho || item.offending_text || '').trim();

            if (!comentario || !trecho) {
                return null;
            }

            return {
                ordem: Number.isFinite(Number(item.ordem)) ? Number(item.ordem) : undefined,
                metodologia: String(item.metodologia || item.category || 'comentário local'),
                bloco_textual: item.bloco_textual ? String(item.bloco_textual) : null,
                competencia_enem: item.competencia_enem ? String(item.competencia_enem) : null,
                impacto_nota: item.impacto_nota ? String(item.impacto_nota) : null,
                comentario,
                trecho,
                sugestao: item.sugestao ? String(item.sugestao) : null,
                exemplo: item.exemplo ? String(item.exemplo) : null,
                reconhecimento: item.reconhecimento ? String(item.reconhecimento) : null,
                pergunta_reflexiva: item.pergunta_reflexiva ? String(item.pergunta_reflexiva) : null,
                orientacao_futura: item.orientacao_futura ? String(item.orientacao_futura) : null,
            } as WorkerRagIssue;
        })
        .filter((issue): issue is WorkerRagIssue => issue !== null)
        .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}
