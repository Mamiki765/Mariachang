import { simpleGit } from 'simple-git';
import fs from 'fs/promises';
import path from 'path';
import { Sticker } from '../models/database.mjs';

// この関数が、HTML生成からデプロイまでの全てを行います
export async function deployStickerListPage() {
  // 認証トークンを環境変数から読み込みます
  const token = process.env.GH_PAGES_TOKEN;
  if (!token) {
    console.error('[Deploy Service] Error: GitHubの認証トークン(GH_PAGES_TOKEN)が設定されていません。');
    return;
  }
  
  // リポジトリの情報
  const repoUrl = `https://x-access-token:${token}@github.com/Mamiki765/Mariachang-pages.git`;
  const localPath = path.join(process.cwd(), 'temp-pages-repo');

  try {
    console.log('[Deploy Service] スタンプ一覧ページのデプロイ処理を開始します...');

    // 1. データベースから公開スタンプの情報を取得します
    const publicStickers = await Sticker.findAll({
      where: { isPublic: true },
      order: [['name', 'ASC']],
    });

    // 2. 取得した情報をもとに、HTMLの文字列を組み立てます
    const pageTitle = "神谷マリア /スタンプ一覧";
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${pageTitle}</title>
        <style>
          body { font-family: sans-serif; background-color: #2c2f33; color: #ffffff; margin: 0; padding: 1.5em; }
          h1 { text-align: center; border-bottom: 2px solid #7289da; padding-bottom: 0.5em; }
          .container { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 1em; }
          .stamp { background-color: #40444b; border-radius: 8px; padding: 10px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
          .stamp img { max-width: 100%; height: 100px; object-fit: contain; }
          .stamp p { margin: 8px 0 0; font-size: 14px; word-break: break-all; color: #dcddde; }
        </style>
      </head>
      <body>
        <h1>${pageTitle} (${publicStickers.length}個)</h1>
        <div class="container">
          ${publicStickers
            .map(
              (sticker) => `
            <div class="stamp">
              <img src="${sticker.imageUrl}" alt="${sticker.name}" loading="lazy">
              <p>${sticker.name}</p>
            </div>`
            )
            .join("")}
        </div>
      </body>
      </html>
    `;

    // 3. Gitを使って、生成したHTMLをGitHub Pagesリポジトリにデプロイします
    const git = simpleGit();
    
    await fs.rm(localPath, { recursive: true, force: true });
    await git.clone(repoUrl, localPath);

    const filePath = path.join(localPath, 'index.html');
    await fs.writeFile(filePath, htmlContent);
    
    const gitRepo = simpleGit(localPath);
    await gitRepo.addConfig('user.name', '神谷マリア');
    await gitRepo.addConfig('user.email', 'mariachang-bot@users.noreply.github.com');
    await gitRepo.add('.');
    
    const status = await gitRepo.status();
    if (status.files.length > 0) {
      await gitRepo.commit('Update: Stamp list automatically updated by the bot');
      await gitRepo.push('origin', 'main');
      console.log('[Deploy Service] HTMLページのGitHub Pagesへのデプロイが完了しました。');
    } else {
      console.log('[Deploy Service] 変更がなかったため、デプロイはスキップされました。');
    }

  } catch (error) {
    console.error('[Deploy Service] HTMLページのデプロイ中にエラーが発生しました:', error);
  } finally {
    // 4. 後片付けとして、一時的に作成したフォルダを必ず削除します
    await fs.rm(localPath, { recursive: true, force: true });
  }
}