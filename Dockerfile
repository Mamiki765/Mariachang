# 1. ベースイメージをpackage.jsonの指定に合わせてNode.js v16にする
FROM node:16-slim

# 2. sqlite3のビルドツールと、Chromium及びその依存関係をインストールする
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    make \
    g++ \
    chromium \
    libx11-xcb1 \
    libxss1 \
    libasound2 \
    libnss3 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libatspi2.0-0 \
    wget \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 3. アプリケーションの作業ディレクトリを作成
WORKDIR /app

# 4. 依存関係をインストールするためにpackage.jsonとlockファイルを先にコピー
COPY package*.json ./

# 5. npm installを実行
#    (sqlite3のビルドもここで行われる)
RUN npm install

# 6. プロジェクトのすべてのファイルをコピー
COPY . .

# 7. アプリケーションを起動するコマンド (package.jsonのstartスクリプトと同じ)
CMD ["node", "main.mjs"]