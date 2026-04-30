export interface RedacaoJobData {
    textoRedacao?: string;
    titulo?: string;
    tema?: string;
    proposalSheetText?: string | null;
    imageBase64?: string | null;
    imageUrl?: string | null;
    submittedAt?: string;
}

export interface WorkerRagIssue {
    ordem?: number;
    metodologia: string;
    bloco_textual?: string | null;
    competencia_enem?: string | null;
    impacto_nota?: string | null;
    comentario: string;
    trecho: string;
    sugestao?: string | null;
    exemplo?: string | null;
    reconhecimento?: string | null;
    pergunta_reflexiva?: string | null;
    orientacao_futura?: string | null;
}

export interface OcrExtractionResult {
    used: boolean;
    method: 'redaline-ocr' | 'google-vision' | 'fallback' | 'none';
    confidence: number;
    processingTime: number;
    wordCount: number;
    text: string;
    note?: string;
}

export interface BasicTextAnalysis {
    temaIdentificado: string | null;
    palavras: number;
    paragrafos: number;
    repetidas: Array<{ palavra: string; vezes: number }>;
    vicios: string[];
    conectivos: string[];
    frasesLongas: string[];
    intervencao: {
        agente: boolean;
        acao: boolean;
        meio: boolean;
        finalidade: boolean;
        detalhamento: boolean;
    };
    ttr: number;
    marcadores: string[];
}

export interface GeminiAssessment {
    summary: string;
    score: {
        c1: number;
        c2: number;
        c3: number;
        c4: number;
        c5: number;
        total: number;
    };
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
    model?: string;
}

export interface RedacaoProcessingResult {
    jobId: string;
    status: 'completed';
    processedAt: string;
    titulo: string;
    tema: string;
    textoLength: number;
    source: 'text' | 'ocr';
    ocr?: OcrExtractionResult | null;
    analysis: BasicTextAnalysis;
    gemini?: GeminiAssessment | null;
    ragIssues: WorkerRagIssue[];
    message: string;
}
