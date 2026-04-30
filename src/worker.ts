import 'dotenv/config';
import pino from 'pino';
import { createRedacaoWorker } from './lib/queue-config.js';
import { processRedacao } from './lib/analyzer.js';
import { closeRedisConnection } from './lib/redis.js';
import { env } from './config/env.js';

const logger = pino({
    level: env.logLevel,
});

async function main() {
    logger.info('🚀 Iniciando worker de redação...');
    logger.info(`   Ambiente: ${env.nodeEnv}`);
    logger.info(`   Redis: ${env.redisUrl ? 'REDIS_URL' : `${env.redisHost}:${env.redisPort}`}`);

    try {
        // Criar e iniciar worker
        const worker = await createRedacaoWorker(processRedacao);

        logger.info('✅ Worker pronto para processar jobs da fila "corrigir-redacao"');
        logger.info('📍 Aguardando jobs... (Pressione Ctrl+C para parar)');

        // Graceful shutdown
        process.on('SIGTERM', async () => {
            logger.warn('📴 SIGTERM recebido - encerrando gracefully...');
            await worker.close();
            await closeRedisConnection();
            process.exit(0);
        });

        process.on('SIGINT', async () => {
            logger.warn('📴 SIGINT recebido - encerrando gracefully...');
            await worker.close();
            await closeRedisConnection();
            process.exit(0);
        });
    } catch (error) {
        logger.error('❌ Erro ao iniciar worker:', error);
        process.exit(1);
    }
}

main();
