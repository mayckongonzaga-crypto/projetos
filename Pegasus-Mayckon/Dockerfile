# ==============================================================================
# Dockerfile - Pegasus-Mayckon
# Multi-stage build para aplicação fullstack Node.js (React + Express/tRPC)
# ==============================================================================

# --- Stage 1: Base com dependências nativas ---
FROM node:20-alpine AS base

# Dependências nativas para compilar 'canvas' (chartjs-node-canvas)
RUN apk add --no-cache \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev \
    pixman-dev \
    python3 \
    g++ \
    make \
    pkgconf

# Habilitar pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

WORKDIR /app

# --- Stage 2: Instalar dependências ---
FROM base AS deps

COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

RUN pnpm install --frozen-lockfile

# --- Stage 3: Build da aplicação ---
FROM deps AS build

COPY . .

# Build do frontend (Vite) e backend (esbuild)
RUN pnpm run build

# --- Stage 4: Imagem de produção ---
FROM node:20-alpine AS production

# Dependências de runtime para 'canvas' (sem compiladores)
RUN apk add --no-cache \
    cairo \
    pango \
    jpeg \
    giflib \
    librsvg \
    pixman \
    fontconfig \
    ttf-freefont

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

WORKDIR /app

# Copiar package.json e node_modules de produção
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Instalar apenas dependências de produção
COPY --from=deps /app/node_modules ./node_modules
RUN pnpm prune --prod

# Copiar build (frontend + backend)
COPY --from=build /app/dist ./dist

# Copiar migrations do Drizzle
COPY drizzle/ ./drizzle/
COPY drizzle.config.ts ./

# Copiar shared types
COPY shared/ ./shared/

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "dist/index.js"]
