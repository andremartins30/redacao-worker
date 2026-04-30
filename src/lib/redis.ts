import 'dotenv/config';
import Redis from 'ioredis';
import pino from 'pino';
import { env } from '../config/env.js';

const logger = pino();

let redisConnection: Redis | null = null;

export function getRedisConnection(): Redis {
    if (redisConnection) {
        return redisConnection;
    }

    try {
        if (env.redisUrl) {
            logger.info(`Conectando ao Redis via URL: ${env.redisUrl.split('@')[1] || 'localhost'}`);
            redisConnection = new Redis(env.redisUrl, {
                maxRetriesPerRequest: null,
                retryStrategy(times) {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                },
            });
        } else {
            logger.info(`Conectando ao Redis: ${env.redisHost}:${env.redisPort}`);
            redisConnection = new Redis({
                host: env.redisHost,
                port: env.redisPort,
                password: env.redisPassword,
                db: env.redisDb,
                maxRetriesPerRequest: null,
                retryStrategy(times) {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                },
            });
        }

        redisConnection.on('connect', () => {
            logger.info('✅ Redis conectado com sucesso');
        });

        redisConnection.on('error', (error) => {
            logger.error('❌ Erro de conexão Redis:', error.message);
        });

        redisConnection.on('reconnecting', () => {
            logger.warn('🔄 Reconectando ao Redis...');
        });

        return redisConnection;
    } catch (error) {
        logger.error('Erro ao criar conexão Redis:', error);
        throw error;
    }
}

export async function closeRedisConnection(): Promise<void> {
    if (redisConnection) {
        await redisConnection.quit();
        redisConnection = null;
        logger.info('Redis desconectado');
    }
}
