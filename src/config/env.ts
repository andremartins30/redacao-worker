type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

function parseInteger(value: string | undefined, fallback: number, name: string): number {
    if (!value) {
        return fallback;
    }

    const parsed = Number.parseInt(value, 10);

    if (Number.isNaN(parsed)) {
        throw new Error(`Valor inválido para ${name}: ${value}`);
    }

    return parsed;
}

function parseLogLevel(value: string | undefined): LogLevel {
    const allowedLevels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
    const resolvedLevel = (value || 'info') as LogLevel;

    if (!allowedLevels.includes(resolvedLevel)) {
        throw new Error(`Valor inválido para LOG_LEVEL: ${value}`);
    }

    return resolvedLevel;
}

export const env = {
    nodeEnv: process.env.NODE_ENV || 'development',
    redisUrl: process.env.REDIS_URL,
    redisHost: process.env.REDIS_HOST || 'localhost',
    redisPort: parseInteger(process.env.REDIS_PORT, 6379, 'REDIS_PORT'),
    redisPassword: process.env.REDIS_PASSWORD,
    redisDb: parseInteger(process.env.REDIS_DB, 0, 'REDIS_DB'),
    workerConcurrency: parseInteger(process.env.WORKER_CONCURRENCY, 1, 'WORKER_CONCURRENCY'),
    logLevel: parseLogLevel(process.env.LOG_LEVEL),
};
