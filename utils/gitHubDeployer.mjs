import { simpleGit } from "simple-git";
import fs from "fs/promises";
import path from "path";
import { Sticker } from "../models/database.mjs";

// この関数が、HTML生成からデプロイまでの全てを行います
export async function deployStickerListPage() {
  // 認証トークンを環境変数から読み込みます
  const token = process.env.GH_PAGES_TOKEN;
  if (!token) {
    console.error(
      "[Deploy Service] Error: GitHubの認証トークン(GH_PAGES_TOKEN)が設定されていません。"
    );
    return;
  }

  // リポジトリの情報
  const repoUrl = `https://x-access-token:${token}@github.com/Mamiki765/Mariachang-pages.git`;
  const localPath = path.join(process.cwd(), "temp-pages-repo");

  try {
    console.log(
      "[Deploy Service] スタンプ一覧ページのデプロイ処理を開始します..."
    );

    // 1. データベースから公開スタンプの情報を取得します
    const publicStickers = await Sticker.findAll({
      where: { isPublic: true },
      order: [["name", "ASC"]],
    });

    // 2. 取得した情報をもとに、HTMLの文字列を組み立てます
    const pageTitle = "神谷マリア /スタンプ一覧";
    const htmlContent = /* HTML */ `
      <!DOCTYPE html>
      <html lang="ja">
      <!-- ミョミョミョワァァーン -->
        <head>
          <meta charset="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <title>${pageTitle}</title>
          <!-- ファビコン -->
          <link rel="icon" href="favicon.ico" sizes="any" type="image/x-icon">
          <link rel="apple-touch-icon" href="apple-touch-icon.png">
          <style>
  body {
    font-family: sans-serif;
    background-color: #2c2f33;
    color: #ffffff;
    margin: 0;
    padding: 1.5em;
  }

  h1 {
    text-align: center;
    border-bottom: 2px solid #7289da;
    padding-bottom: 0.5em;
  }

  .description {
    max-width: 900px;
    margin: 0 auto 1.5em auto;
    line-height: 1.7;
  }

  .stamp-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 16px;
    margin-top: 1.5em;
  }

  .stamp-card {
    background-color: #40444b;
    border: 1px solid #555;
    border-radius: 8px;
    padding: 12px;
    text-align: center;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .stamp-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .stamp-card img {
    width: 100%;
    height: 120px;
    object-fit: contain;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
  }

  .stamp-name {
    margin-top: 10px;
    font-weight: bold;
    font-size: 0.95rem;
    word-break: break-word;
  }

  .stamp-link {
    color: inherit;
    text-decoration: none;
  }

  .stamp-link:hover .stamp-name {
    text-decoration: underline;
  }

  ul {
    line-height: 1.7;
  }
</style>
        </head>
        <body>
<h1>${pageTitle} (${publicStickers.length}個)</h1>

<div class="description">
  <p>
    /スタンプ 投稿 で使える公共スタンプの一覧です。<br />
    画像を一覧で見ながら、名前を確認できます。
  </p>

  <hr />

  <h3>使い方</h3>
  <ul>
    <li>
      <strong>/スタンプ 投稿 [名前]</strong>:
      スタンプを投稿します。名前を入力すると候補が表示されます。
    </li>
    <li>
      <strong>/スタンプ 登録 [画像] [名前] [公開設定]</strong>:
      新しいスタンプを登録します。
      <ul>
        <li>
          画像は <strong>800x800px</strong> 以下、<strong>10MB</strong>
          以下にしてください。
        </li>
        <li>
          登録は一人<strong>50件</strong>までです。（Mod/ILは255件まで）
        </li>
      </ul>
    </li>
  </ul>

  <h3>公開設定について</h3>
  <p>
    スタンプを「公開」にすると、サーバーの誰もが使えるようになり、この一覧にも掲載されます。<br />
    <strong>PBW納品物</strong> などを新規に登録する際は、各会社の利用規約をよくご確認の上、
    「外部利用ライセンス」などを取得した作品のみを公開設定にすることを推奨します。
  </p>
</div>

<div class="stamp-grid">
  ${publicStickers
        .map(
          (sticker) => `
        <a class="stamp-link" href="${sticker.imageUrl}" target="_blank" rel="noopener noreferrer">
          <div class="stamp-card">
            <img src="${sticker.imageUrl}" alt="${sticker.name}" loading="lazy">
            <div class="stamp-name">${sticker.name}</div>
          </div>
        </a>
      `
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

    const filePath = path.join(localPath, "index.html");
    await fs.writeFile(filePath, htmlContent);

    const gitRepo = simpleGit(localPath);
    await gitRepo.addConfig("user.name", "神谷マリア");
    await gitRepo.addConfig(
      "user.email",
      "mariachang-bot@users.noreply.github.com"
    );
    await gitRepo.add(".");

    const status = await gitRepo.status();
    if (status.files.length > 0) {
      await gitRepo.commit(
        "Update: Stamp list automatically updated by the bot"
      );
      await gitRepo.push("origin", "main");
      console.log(
        "[Deploy Service] HTMLページのGitHub Pagesへのデプロイが完了しました。"
      );
    } else {
      console.log(
        "[Deploy Service] 変更がなかったため、デプロイはスキップされました。"
      );
    }
  } catch (error) {
    console.error(
      "[Deploy Service] HTMLページのデプロイ中にエラーが発生しました:",
      error
    );
  } finally {
    // 4. 後片付けとして、一時的に作成したフォルダを必ず削除します
    await fs.rm(localPath, { recursive: true, force: true });
  }
}
