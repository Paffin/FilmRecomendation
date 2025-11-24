FROM node:20-bookworm AS builder
WORKDIR /app

COPY package*.json ./
# package-lock лежит в корне монорепо, но для независимой сборки используем install с контролем peer deps
RUN npm install --legacy-peer-deps
COPY tsconfig*.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate
RUN npm run build

FROM node:20-bookworm
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
ENV PORT=3000
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
