FROM node:22-slim

ENV NODE_ENV=production

WORKDIR /app

# Copy all config files in one step to avoid isolated-COPY cache misses
COPY backend/package*.json backend/tsconfig.json backend/prisma.config.ts ./

RUN npm install --include=dev

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/src ./src
RUN npm run build

EXPOSE 5000

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/index.js"]
