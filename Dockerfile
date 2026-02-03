# Dockerfile (軽量版)
FROM node:24-slim

# git 本体と、サーバー証明書を検証するための ca-certificates をインストールする
RUN apt-get update && apt-get install -y \
    git \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3000
CMD ["npm", "run", "startenv"]