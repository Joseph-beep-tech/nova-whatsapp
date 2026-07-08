FROM node:22-slim

RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

WORKDIR /app

# Build context is repo root — all paths must be prefixed with backend/
COPY backend/package*.json ./
RUN npm install --include=dev

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/src ./src
COPY backend/tsconfig.json ./

RUN npm run build

EXPOSE 5000

# JSON array form (avoids OS signal warning); shell -c to chain two commands
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/index.js"]
