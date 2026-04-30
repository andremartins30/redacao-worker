#!/usr/bin/env node

/**
 * Script para testar comunicação entre RedacaoIA (producer) e redacao-worker (consumer)
 * 
 * Uso:
 *   node test-producer.js
 * 
 * Pré-requisitos:
 *   - Redis rodando em 143.198.73.42:6379
 *   - Worker rodando (npm run dev)
 */

import { Queue } from 'bullmq';
import Redis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || '143.198.73.42';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || 'Redaline2025@';

const connection = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    maxRetriesPerRequest: null,
});

async function testQueue() {
    try {
        console.log('🧪 Testando sistema de filas...\n');

        const redacaoQueue = new Queue('corrigir-redacao', { connection });

        const jobData = {
            textoRedacao: 'Este é um texto de teste para validar o sistema de filas BullMQ. ' +
                'O worker deve processar este job e retornar o status de conclusão. ' +
                'Este é um teste end-to-end do sistema de filas assincrono.',
            titulo: 'Teste de Filas Worker',
            tema: 'Processamento Assincrono',
            proposalSheetText: 'Proposta de teste',
            submittedAt: new Date().toISOString(),
        };

        console.log('📨 Enfileirando job...');
        console.log(`  Texto: ${jobData.textoRedacao.substring(0, 60)}...`);
        console.log(`  Tema: ${jobData.tema}\n`);

        const job = await redacaoQueue.add('corrigir-redacao', jobData);

        console.log('✅ Job enfileirado com sucesso!');
        console.log(`  Job ID: ${job.id}`);
        console.log(`  Status: queued\n`);

        console.log('⏳ Aguardando processamento (6 segundos)...\n');
        await new Promise((resolve) => setTimeout(resolve, 6000));

        const updatedJob = await redacaoQueue.getJob(job.id);

        console.log('📊 Status após processamento:');
        console.log(`  Job ID: ${updatedJob?.id}`);
        console.log(`  Estado: ${await updatedJob?.getState()}`);

        if (updatedJob?.returnvalue) {
            console.log('  Resultado:');
            console.log('   ', JSON.stringify(updatedJob.returnvalue, null, 2));
        }

        await redacaoQueue.close();
        await connection.quit();

        console.log('\n✨ Teste concluído!\n');

    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

testQueue();
