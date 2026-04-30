# 🎯 Redacao Worker

Worker BullMQ para processamento assíncrono de redações. Consome jobs de uma fila Redis e realiza análises de redações.

## 🏗️ Arquitetura

```
┌────────────────────────────────────┐
│  RedacaoIA (Next.js na Vercel)     │
│  - Endpoint /api/analyze           │
│  - Enfileira jobs                  │
└──────────┬─────────────────────────┘
           │ (enqueue via BullMQ)
           ↓
    ┌──────────────┐
    │ Redis Queue  │
    │ (Ubuntu)     │
    └──────────────┘
           ↑
           │ (consume)
│  Redacao Worker (Node.js)          │
│  - Este projeto                    │
│  - Processa jobs                   │
│  - Rodar como container no servidor│
└────────────────────────────────────┘
```

## 🚀 Quick Start

### Desenvolvimento Local

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais

# 3. Rodar em modo desenvolvimento (com auto-reload)
npm run dev
```

### Testes Locais com Docker

```bash
# Build e inicia Redis + Worker juntos
docker-compose up -d

# Ver logs do worker
docker logs -f redacao-worker

# Parar
docker-compose down
```

## 📦 Deployment no Servidor Ubuntu

### Opção 1: Via Docker Compose de Produção (Recomendado ⭐)

```bash
# 1. No servidor, clone o repositório do worker
cd ~/projects
git clone https://github.com/andremartins30/redacao-worker.git
cd redacao-worker

# 2. Configure o .env com o Redis remoto
cp .env.example .env
nano .env

# 3. Suba apenas o worker
docker compose -f docker-compose.prod.yml up -d --build

# 4. Verifique os logs
docker logs -f redacao-worker
```

### Opção 2: Build Manual

```bash
# Build da imagem
docker build -t redacao-worker:latest .

# Run com Redis externo
docker run -d \
  --name redacao-worker \
  -e REDIS_HOST=143.198.73.42 \
  -e REDIS_PORT=6379 \
  -e REDIS_PASSWORD=Redaline2025@ \
  -e NODE_ENV=production \
  redacao-worker:latest
```

## 📋 Scripts Disponíveis

```bash
npm run dev       # Rodar em modo desenvolvimento (auto-reload)
npm run build     # Compilar TypeScript
npm start         # Rodar versão compilada
npm run lint      # Linter (ESLint)
```

## 🔧 Configuração

### Variáveis de Ambiente

| Variável             | Padrão      | Descrição                                      |
| -------------------- | ----------- | ---------------------------------------------- |
| `REDIS_HOST`         | localhost   | Host do Redis                                  |
| `REDIS_PORT`         | 6379        | Porta do Redis                                 |
| `REDIS_PASSWORD`     | -           | Senha do Redis                                 |
| `REDIS_DB`           | 0           | Banco de dados Redis                           |
| `REDIS_URL`          | -           | URL Redis (sobrescreve host/port/password)     |
| `WORKER_CONCURRENCY` | 1           | Número de jobs simultâneos                     |
| `LOG_LEVEL`          | info        | Nível de log (trace, debug, info, warn, error) |
| `NODE_ENV`           | development | Ambiente (development, production)             |

## 📊 Monitoramento

### Verificar Status do Worker

```bash
# Ver logs em tempo real
docker logs -f redacao-worker

# Verificar saúde
docker exec redacao-worker node -e "require('ioredis').createClient().ping()"

# Contar jobs na fila
docker exec redis redis-cli -a "Redaline2025@" LLEN bull:corrigir-redacao
```

### Reiniciar Worker

```bash
# Graceful restart
docker restart redacao-worker

# Stop e start
docker stop redacao-worker
docker start redacao-worker
```

## 🐛 Troubleshooting

### Worker não conecta ao Redis

```bash
# 1. Verificar se Redis está rodando
docker ps | grep redis

# 2. Testar conexão manualmente
docker exec redis redis-cli -a "Redaline2025@" ping

# 3. Verificar logs de erro
docker logs redacao-worker
```

### Rebuild após atualizações

```bash
# Parar containers
docker-compose down

# Rebuild sem cache
docker-compose build --no-cache

# Iniciar novamente
docker-compose up -d
```

## 🔄 Ciclo de Vida do Job

1. **Frontend** (Vercel) - Usuário submete redação
2. **API Producer** (/api/analyze) - Next.js enfileira job no Redis
3. **Queue** (Redis) - Job aguardando processamento
4. **Worker** (este projeto) - Processa job
5. **Result** - Resultado armazenado/retornado

## 📈 FASE 2: Próximas Melhorias

 [x] Pipeline real do worker com análise textual local
 [x] Integrações opcionais com OCR, Gemini e RAG via variáveis de ambiente

## 📝 Estrutura de Arquivos

```
redacao-worker/
├── src/
│   ├── config/
│   │   └── env.ts             # Validação centralizada de ambiente
│   ├── lib/
│   │   ├── analyzer.ts        # Pipeline real do worker
│   │   ├── external-services.ts # OCR/Gemini/RAG opcionais
│   │   ├── text-analysis.ts   # Análise textual local
│   │   ├── types.ts           # Tipos compartilhados do worker
│   │   ├── queue-config.ts    # Configuração BullMQ
│   │   └── redis.ts           # Conexão Redis
│   └── worker.ts              # Entry point do worker
├── dist/                      # Saída compilada (gerado)
├── Dockerfile                 # Container image
├── docker-compose.yml         # Orquestração local com Redis + worker
├── docker-compose.prod.yml    # Deploy do worker em produção
├── package.json               # Dependências
├── tsconfig.json              # Configuração TypeScript
└── .env.example               # Template de configuração
```

## 📄 Licença

MIT

## 👨‍💻 Autor
| `ENABLE_GEMINI_ANALYSIS` | true     | Liga/desliga análise com Gemini                |
| `ENABLE_RAG_REVIEW`  | true        | Liga/desliga revisão RAG                       |
| `GEMINI_API_KEY`     | -           | Chave da API Gemini                            |
| `GEMINI_MODEL`       | gemini-2.5-flash | Modelo usado no Gemini                      |
| `OCR_SERVICE_URL`    | -           | URL do serviço de OCR externo                  |
| `OCR_API_KEY`        | -           | Chave do serviço de OCR                        |
| `RAG_REVIEW_URL`     | -           | URL do endpoint de revisão RAG                 |
| `REQUEST_TIMEOUT_MS` | 120000      | Timeout para chamadas externas                 |

Redaline - Sistema de Análise de Redações
# redacao-worker
