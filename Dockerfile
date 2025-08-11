# Dockerfile (軽量版)
FROM node:22-slim

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
RUN npm install --omit=dev
COPY . .
CMD ["npm", "start"]