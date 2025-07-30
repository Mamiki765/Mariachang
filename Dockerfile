# Dockerfile (軽量版)
FROM node:18-slim

# sqlite3のビルドツールだけ残す
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    make \
    g++ \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "main.mjs"]