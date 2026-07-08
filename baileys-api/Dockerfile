FROM node:22-slim

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm install --production --ignore-scripts

COPY server.js ./

EXPOSE 3000

CMD ["node", "server.js"]
