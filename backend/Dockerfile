FROM node:22-slim

ENV NODE_ENV=production

WORKDIR /app

# Build context is repo root — all paths must be prefixed with backend/
COPY backend/package*.json ./
RUN npm install --include=dev

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/src ./src
COPY backend/tsconfig.json ./
COPY backend/prisma.config.ts ./

RUN npm run build

EXPOSE 5000

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/index.js"]
