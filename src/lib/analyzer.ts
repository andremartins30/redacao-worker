import pino from 'pino';
import type { RedacaoJobData, RedacaoProcessingResult } from './types.js';
import { analisarTexto, resumirAnaliseBasica } from './text-analysis.js';
import { analisarComGemini, buscarIssuesRag, extrairTextoOCR } from './external-services.js';

const logger = pino();

function normalizarJobData(data: unknown): RedacaoJobData {
    if (!data || typeof data !== 'object') {
        return {};
    }

    return data as RedacaoJobData;
}

/**
 * Processa uma redação com pipeline real:
 * OCR opcional -> análise local -> Gemini opcional -> RAG opcional.
 */
export async function processRedacao(job: any): Promise<RedacaoProcessingResult> {
    const jobData = normalizarJobData(job?.data);
    const textoOriginal = String(jobData.textoRedacao || '').trim();
    const titulo = String(jobData.titulo || 'Redação sem título');
    const temaInicial = String(jobData.tema || 'Tema não especificado');

    logger.info(`⏳ [Worker] Iniciando job ${job.id}: ${textoOriginal.slice(0, 50)}...`);

    try {
        const ocrResult = await extrairTextoOCR(jobData);

        const textoParaAnalise = (ocrResult?.text || textoOriginal).trim();
        if (!textoParaAnalise) {
            throw new Error('Job sem texto para processar');
        }

        const analiseLocal = analisarTexto(textoParaAnalise);
        const temaFinal = temaInicial !== 'Tema não especificado'
            ? temaInicial
            : analiseLocal.temaIdentificado || 'Tema não especificado';

        const [geminiResult, ragIssues] = await Promise.all([
            analisarComGemini(jobData, textoParaAnalise),
            buscarIssuesRag(textoParaAnalise, jobData.proposalSheetText),
        ]);

        const resultado: RedacaoProcessingResult = {
            jobId: String(job.id),
            status: 'completed',
            processedAt: new Date().toISOString(),
            textoLength: textoParaAnalise.length,
            titulo,
            tema: temaFinal,
            source: ocrResult?.used ? 'ocr' : 'text',
            ocr: ocrResult,
            analysis: analiseLocal,
            gemini: geminiResult,
            ragIssues,
            message: [
                'Job processado com sucesso',
                ocrResult?.used ? 'OCR aplicado' : 'texto analisado diretamente',
                geminiResult ? 'Gemini aplicado' : 'Gemini indisponível ou desativado',
                ragIssues.length > 0 ? `RAG retornou ${ragIssues.length} apontamentos` : 'RAG sem apontamentos',
            ].join(' | '),
        };

        logger.info(`✅ [Worker] Job ${job.id} concluído: ${resumirAnaliseBasica(analiseLocal)}`);

        return resultado;
    } catch (error) {
        logger.error(`❌ [Worker] Erro ao processar job ${job.id}:`, {
            error: (error as Error).message,
            stack: (error as Error).stack,
        });
        throw error;
    }
}
