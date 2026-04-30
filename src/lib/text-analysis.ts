import type { BasicTextAnalysis } from './types.js';

const VICIOS_DE_LINGUAGEM = [
    'coisa', 'tipo assim', 'daí', 'então', 'né', 'aí', 'cara', 'meio que', 'tipo', 'beleza',
    'massa', 'legal', 'bacana', 'maneiro', 'da hora', 'gente', 'pessoal', 'galera', 'povo',
    'troço', 'negócio', 'sei lá', 'sabe', 'entende', 'sacou', 'tá ligado', 'pô', 'véi', 'mano',
];

const CONECTIVOS = [
    'portanto', 'logo', 'enfim', 'assim', 'consequentemente', 'além disso', 'ademais', 'com efeito',
    'desse modo', 'dessa forma', 'em suma', 'por conseguinte', 'entretanto', 'porém', 'mas', 'contudo',
    'todavia', 'no entanto', 'apesar disso', 'ainda que', 'embora', 'mesmo que', 'porque', 'pois',
    'visto que', 'uma vez que', 'já que', 'diante disso', 'nesse sentido', 'por outro lado',
    'em contrapartida', 'sobretudo', 'principalmente', 'especialmente', 'primeiramente', 'por fim',
];

const MARCADORES_ARGUMENTATIVOS = [
    'segundo', 'de acordo com', 'conforme', 'como afirma', 'por exemplo', 'isso se evidencia',
    'prova disso', 'como pode ser observado', 'isto é', 'ou seja', 'em outras palavras',
];

const PALAVRAS_CHAVE_INTERVENCAO = {
    agente: [
        'governo', 'ministério', 'secretaria', 'poder público', 'prefeitura', 'prefeito', 'governador',
        'estado', 'município', 'mídia', 'ong', 'sociedade civil', 'família', 'empresa', 'indústria',
    ],
    acao: [
        'criar', 'promover', 'implementar', 'garantir', 'desenvolver', 'investir', 'fiscalizar',
        'conscientizar', 'ampliar', 'melhorar', 'reformar', 'estabelecer', 'incentivar', 'reduzir',
        'combater', 'capacitar', 'educar', 'regulamentar', 'aprovar', 'sancionar',
    ],
    meio: [
        'por meio de', 'através de', 'mediante', 'por intermédio de', 'com a criação de',
        'com a implementação de', 'política pública', 'políticas públicas', 'lei', 'decreto',
        'projeto de lei', 'legislação', 'regulamento',
    ],
    finalidade: [
        'a fim de', 'para que', 'com o objetivo de', 'com o intuito de', 'de modo a', 'de forma a',
        'visando', 'com vistas a', 'com a finalidade de', 'com o propósito de',
    ],
    detalhamento: [
        'por exemplo', 'isto é', 'ou seja', 'especificamente', 'em especial', 'no prazo de', 'a curto prazo',
        'a longo prazo', 'gradualmente', 'progressivamente', 'com monitoramento', 'com fiscalização',
        'acompanhamento', 'avaliação',
    ],
};

function normalizarTexto(texto: string): string {
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenize(texto: string): string[] {
    return normalizarTexto(texto)
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token.length > 2);
}

function contarOcorrencias(texto: string, termo: string): number {
    const regex = new RegExp(`\\b${termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    return (texto.match(regex) || []).length;
}

export function identificarTema(texto: string): { tema: string | null; textoRedacao: string } {
    const blocos = texto.split(/\n+/).map((item) => item.trim()).filter(Boolean);

    if (blocos.length === 0) {
        return { tema: null, textoRedacao: texto };
    }

    const primeiroParagrafo = blocos[0];
    const palavrasPrimeiroParagrafo = primeiroParagrafo.split(/\s+/).filter(Boolean).length;
    const indicadoresTema = [
        /^tema:/i,
        /^proposta:/i,
        /^quest[aã]o:/i,
        /^redija/i,
        /^com base/i,
        /^considerando/i,
        /dissertativ.-argumentativ/i,
        /modalidade escrita formal/i,
        /defenda/i,
        /proposta de interven[cç][aã]o/i,
    ];

    const pareceTema = indicadoresTema.some((regex) => regex.test(primeiroParagrafo));
    const muitoCurto = palavrasPrimeiroParagrafo < 15;

    if (pareceTema || muitoCurto) {
        return {
            tema: primeiroParagrafo,
            textoRedacao: blocos.slice(1).join('\n\n'),
        };
    }

    return { tema: null, textoRedacao: texto };
}

export function analisarTexto(textoOriginal: string): BasicTextAnalysis {
    const texto = textoOriginal.trim();
    const { tema, textoRedacao } = identificarTema(texto);
    const palavras = tokenize(textoRedacao);
    const palavrasUnicas = new Set(palavras);
    const paragrafos = textoRedacao.split(/\n\n+/).map((item) => item.trim()).filter(Boolean);

    const frequencias = new Map<string, number>();
    for (const palavra of palavras) {
        frequencias.set(palavra, (frequencias.get(palavra) || 0) + 1);
    }

    const repetidas = Array.from(frequencias.entries())
        .filter(([, vezes]) => vezes >= 3)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([palavra, vezes]) => ({ palavra, vezes }));

    const textoNormalizado = normalizarTexto(textoRedacao);
    const vicios = VICIOS_DE_LINGUAGEM.filter((vicio) => textoNormalizado.includes(vicio));
    const conectivos = CONECTIVOS.filter((conectivo) => textoNormalizado.includes(conectivo));
    const marcadores = MARCADORES_ARGUMENTATIVOS.filter((marcador) => textoNormalizado.includes(marcador));

    const frasesLongas = textoRedacao
        .split(/(?<=[.!?])\s+/)
        .map((frase) => frase.trim())
        .filter(Boolean)
        .filter((frase) => frase.split(/\s+/).length > 40)
        .slice(0, 10);

    const intervencao = {
        agente: PALAVRAS_CHAVE_INTERVENCAO.agente.some((termo) => textoNormalizado.includes(termo)),
        acao: PALAVRAS_CHAVE_INTERVENCAO.acao.some((termo) => textoNormalizado.includes(termo)),
        meio: PALAVRAS_CHAVE_INTERVENCAO.meio.some((termo) => textoNormalizado.includes(termo)),
        finalidade: PALAVRAS_CHAVE_INTERVENCAO.finalidade.some((termo) => textoNormalizado.includes(termo)),
        detalhamento: PALAVRAS_CHAVE_INTERVENCAO.detalhamento.some((termo) => textoNormalizado.includes(termo)),
    };

    const ttr = palavras.length === 0 ? 0 : palavrasUnicas.size / palavras.length;

    return {
        temaIdentificado: tema,
        palavras: palavras.length,
        paragrafos: paragrafos.length,
        repetidas,
        vicios,
        conectivos,
        frasesLongas,
        intervencao,
        ttr,
        marcadores,
    };
}

export function calcularSimilaridadeJaccard(textoA: string, textoB: string): number {
    const tokensA = new Set(tokenize(textoA));
    const tokensB = new Set(tokenize(textoB));

    if (tokensA.size === 0 || tokensB.size === 0) {
        return 0;
    }

    let intersecao = 0;
    for (const token of tokensA) {
        if (tokensB.has(token)) {
            intersecao += 1;
        }
    }

    const uniao = tokensA.size + tokensB.size - intersecao;
    return uniao === 0 ? 0 : intersecao / uniao;
}

export function resumirAnaliseBasica(analise: BasicTextAnalysis): string {
    return [
        `Palavras: ${analise.palavras}`,
        `Parágrafos: ${analise.paragrafos}`,
        `TTR: ${analise.ttr.toFixed(2)}`,
        `Conectivos: ${analise.conectivos.length}`,
        `Marcadores: ${analise.marcadores.length}`,
    ].join(' | ');
}
