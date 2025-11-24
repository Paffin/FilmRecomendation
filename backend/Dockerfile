FROM node:20-bullseye AS builder
WORKDIR /app
ARG PRISMA_BINARY_TARGET=linux-arm64-openssl-1.1.x
ENV PRISMA_CLI_BINARY_TARGETS=${PRISMA_BINARY_TARGET}
ENV PRISMA_CLIENT_ENGINE_TYPE=binary
COPY package*.json ./
# package-lock находится в корне монорепо, поэтому используем install с ослабленными peer deps
RUN npm install --legacy-peer-deps
COPY tsconfig*.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate
RUN npm run build

FROM node:20-bullseye
WORKDIR /app
# libssl1.1 требуется для prisma клиентских бинарей
RUN apt-get update && apt-get install -y --no-install-recommends libssl1.1 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/main.js"]
