FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# package-lock находится в корне монорепо, поэтому используем install с ослабленными peer deps
RUN npm install --legacy-peer-deps
COPY tsconfig*.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/main.js"]
