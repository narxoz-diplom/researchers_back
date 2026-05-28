FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate \
 && npm run build \
 && npm prune --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl libc6-compat dumb-init curl tini \
 && addgroup -S nodejs -g 1001 \
 && adduser -S nestjs -G nodejs -u 1001

COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nestjs:nodejs /app/package*.json ./

USER nestjs
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/api/v1/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
# nest build (module nodenext) emits dist/src/main.js
CMD ["node", "dist/src/main.js"]
