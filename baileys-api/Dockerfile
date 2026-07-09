FROM node:22-bookworm

ENV NODE_ENV=production

WORKDIR /app

# bookworm has git + ca-certificates pre-installed
# Rewrite SSH GitHub URLs to HTTPS so libsignal-node installs without a key
RUN git config --global url."https://github.com/".insteadOf "ssh://git@github.com/"

COPY package*.json ./
# GIT_SSL_NO_VERIFY only affects this build step (git clone of libsignal-node)
RUN GIT_SSL_NO_VERIFY=1 npm install --omit=dev

COPY server.js ./

EXPOSE 3000

CMD ["node", "server.js"]
