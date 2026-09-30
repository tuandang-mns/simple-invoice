# ---- deps: install all dependencies (incl. dev) for building ----
FROM node:22-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---- build: compile TypeScript ----
FROM deps AS build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---- runtime: minimal image, non-root ----
FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node package.json docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
USER node
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
