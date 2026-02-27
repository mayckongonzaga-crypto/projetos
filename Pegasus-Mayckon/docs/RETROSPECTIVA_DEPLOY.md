# 📋 Retrospectiva — Deploy Pegasus-Mayckon em VPS com Docker

**Data:** 20/02/2026  
**Objetivo:** Containerizar o projeto Pegasus-Mayckon e colocá-lo em funcionamento em uma VPS Linux Ubuntu.

---

## O que foi feito

### 1. Análise do projeto

Antes de criar qualquer artefato, o projeto foi analisado em profundidade:

- **Stack:** Node.js (pnpm) + React 19 / Vite / TailwindCSS (frontend) + Express / tRPC (backend)
- **Banco de dados:** MySQL via Drizzle ORM, com 25 migrations SQL na pasta `drizzle/`
- **Dependência nativa crítica:** `chartjs-node-canvas` usa a biblioteca `canvas`, que requer compilação de código nativo C++ (`cairo`, `pango`, `libjpeg` etc.)
- **Gerenciador de pacotes:** `pnpm` com patch customizado do `wouter@3.7.1`
- **Build:** dois passos — `vite build` (frontend → `dist/public`) + `esbuild` (backend → `dist/index.js`)
- **Variáveis de ambiente identificadas:** `DATABASE_URL`, `JWT_SECRET`, `PORT`, `VITE_APP_ID`, `OAUTH_SERVER_URL`, `OWNER_OPEN_ID`, `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`

---

### 2. Artefatos criados

| Arquivo | Descrição |
|---------|-----------|
| `Dockerfile` | Multi-stage build (4 estágios) |
| `docker-compose.yml` | Orquestra app + MySQL 8.0 |
| `.dockerignore` | Otimiza o contexto de build |
| `.env.example` | Template de variáveis de ambiente |
| `DEPLOY_VPS.md` | Guia passo a passo de deploy |

---

### 3. Dockerfile — decisões técnicas

Foram usados **4 estágios** (multi-stage build):

1. **`base`** — Node 20 Alpine com dependências nativas para compilar o `canvas`
2. **`deps`** — Instala todos os pacotes com `pnpm install --frozen-lockfile`
3. **`build`** — Gera o bundle de produção (`vite build` + `esbuild`)
4. **`production`** — Imagem final leve com apenas runtime, sem compiladores

A escolha do **Node 20 Alpine** foi por ser a imagem mais leve compatível com o pnpm 10.x e as dependências nativas exigidas.

---

## Problemas encontrados e soluções

### ⚠️ Problema 1: Porta 3306 já ocupada na VPS

**Sintoma:**
```
Bind for :::3306 failed: port is already allocated
```

**Causa:** A VPS já possuía outro servidor MySQL rodando, e o `docker-compose.yml` original tentava publicar a porta `3306:3306`.

**Solução:** Remover o mapeamento `ports` do serviço `db`. Como o app e o banco se comunicam dentro da rede Docker interna, a porta não precisava ser exposta externamente. Bastou rodar `docker compose down` e `docker compose up -d` novamente — sem rebuildar.

---

### ⚠️ Problema 2: `npx drizzle-kit migrate` roda silenciosamente sem aplicar nada

**Sintoma:** O comando executava mas não exibia nenhuma saída de migration, terminando rapidamente como se não houvesse nada a fazer.

**Causa:** O `npx` busca o `drizzle-kit` localmente pelo caminho errado dentro do container pnpm, rodando sem efetivamente aplicar as migrations.

**Solução:** Usar o script npm do projeto diretamente via `pnpm`:
```bash
docker compose exec app pnpm db:push
```
Esse comando executa `drizzle-kit generate && drizzle-kit migrate`, que exibiu corretamente a saída `[✓] migrations applied successfully!`.

---

### ⚠️ Problema 3: Seed do admin falha na primeira inicialização

**Sintoma:** Nos logs do container:
```
[Seed] Erro ao criar admin: Failed query: select ... from `users` ...
```

**Causa:** O app executa o seed do admin **2 segundos após iniciar** (timeout no código). Na primeira vez, as tabelas ainda não existem porque as migrations não foram aplicadas. O `docker compose up -d` sobe o app imediatamente após o MySQL ficar healthy, mas o banco está vazio.

**Solução:** Após aplicar as migrations com `pnpm db:push`, reiniciar o container:
```bash
docker compose restart app
```
No próximo boot, as tabelas já existem e o seed cria o admin com sucesso.

---

### ⚠️ Problema 4: Credenciais de admin desconhecidas

**Sintoma:** Tela de login exibindo "E-mail ou senha incorretos".

**Causa:** O `seed-admin.mjs` (script avulso) usa credenciais diferentes (`lan7@gmail.com` / `123456`) das credenciais hardcoded no servidor (`server/_core/index.ts`).

**As credenciais corretas do admin padrão são:**
- **E-mail:** `pegasus@lan7.com.br`
- **Senha:** `g08120812`

---

### ℹ️ Observação: `JWSSignatureVerificationFailed` nos logs

**Sintoma:**
```
[Auth] Session verification failed JWSSignatureVerificationFailed: signature verification failed
```

**Causa:** O navegador ainda tinha cookies de sessão assinados com um JWT_SECRET diferente (do ambiente de desenvolvimento). Não é um erro crítico.

**Solução:** Fazer logout no navegador ou limpar os cookies. Os erros desaparecem automaticamente.

---

## Fluxo correto de deploy (resumido)

```bash
# 1. Configurar variáveis
cp .env.example .env && nano .env

# 2. Build e start
docker compose build
docker compose up -d

# 3. Migrations (usar pnpm, não npx!)
docker compose exec app pnpm db:push

# 4. Restart para o seed criar o admin
docker compose restart app

# 5. Verificar
docker compose logs app --tail 10
# Deve conter: [Seed] Admin criado: pegasus@lan7.com.br
```

---

## Lições aprendidas

- **Dependências nativas (canvas) em Alpine:** É necessário instalar runtime libs (`cairo`, `pango`, etc.) tanto no stage de build quanto na imagem de produção — no build para compilar, no runtime para executar.
- **`npx` vs script do projeto:** Em containers com pnpm, prefira sempre usar os scripts definidos no `package.json` via `pnpm run <script>` em vez de `npx <ferramenta>` diretamente.
- **Ordem de inicialização:** Em apps que fazem seed na inicialização, as migrations devem ser aplicadas antes do primeiro boot completo, ou o container deve ser reiniciado após as migrations.
- **Nunca expor a porta do banco desnecessariamente:** O banco de dados não precisa de porta exposta se só é acessado pela própria aplicação.
