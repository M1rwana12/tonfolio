# Single image for bot / worker / web — the same build artifact runs as three
# containers with different commands (see deploy/compose.prod.yml). Keeps the
# e2-micro deploy simple: one pull, shared layers.
FROM node:22-alpine

RUN apk add --no-cache openssl && corepack enable
WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile && pnpm build && pnpm store prune

ENV NODE_ENV=production
CMD ["node", "apps/bot/dist/index.js"]
