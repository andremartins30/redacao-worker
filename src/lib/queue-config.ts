import { Queue, Worker, WorkerOptions, DefaultJobOptions } from 'bullmq';
import { getRedisConnection } from './redis.js';
import pino from 'pino';
import { env } from '../config/env.js';

const logger = pino();

const connection = getRedisConnection();

// Configurações padrão para jobs
const DEFAULT_JOB_OPTIONS: DefaultJobOptions = {
    attempts: 3,
    backoff: {
        type: 'exponential',
        delay: 2000,
    },
    removeOnComplete: {
        age: 3600, // Remove jobs completados após 1 hora
        count: 1000, // Mantém os últimos 1000 jobs
    },
    removeOnFail: {
        age: 604800, // Mantém jobs falhados por 7 dias
    },
};

// Configurações do worker
const WORKER_OPTIONS: WorkerOptions = {
    connection,
    concurrency: env.workerConcurrency,
    limiter: {
        max: 10,
        duration: 60000, // 10 jobs por minuto máximo
    },
};

// Criar queue para redações
export const redacaoQueue = new Queue('corrigir-redacao', {
    connection,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

logger.info('✅ Queue "corrigir-redacao" inicializada');

/**
 * Factory para criar worker
 */
export async function createRedacaoWorker(
    processRedacao: (job: any) => Promise<any>
): Promise<Worker> {
    const worker = new Worker('corrigir-redacao', processRedacao, WORKER_OPTIONS);

    // Event listeners
    worker.on('completed', (job) => {
        logger.info(`✅ Job ${job.id} completado com sucesso`);
    });

    worker.on('failed', (job, error) => {
        logger.error(`❌ Job ${job?.id} falhou:`, {
            error: error?.message,
            stack: error?.stack,
        });
    });

    worker.on('error', (error) => {
        logger.error('❌ Erro no worker:', {
            error: error?.message,
            stack: error?.stack,
        });
    });

    return worker;
}
