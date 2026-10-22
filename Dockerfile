# Dockerfile (軽量版)
FROM node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205

# git本体と、サーバー証明書を検証するためのca-certificates、
# そしてDiscordの音声ストリーミングに必要なffmpegをインストールする
RUN apt-get update && apt-get install -y \
    git \
    ca-certificates \
    ffmpeg \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["npm", "run", "startenv"]