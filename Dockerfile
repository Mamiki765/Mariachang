# Dockerfile (軽量版)
FROM node:22-slim

# sqlite3を再インストールするときはここのコメントを外す
# RUN apt-get update && apt-get install -y \
#     build-essential \
#     python3 \
#     make \
#     g++ \
#     --no-install-recommends \
#     && rm -rf /var/lib/apt/lists/*

# simple-git が内部で git コマンドを呼び出すため、git 本体をインストールする
RUN apt-get update && apt-get install -y git --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3000
CMD ["npm", "start"]