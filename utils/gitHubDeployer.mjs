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
      <!-- ミョミョミョワァァーン --!>
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

            /* --- ここからがアコーディオン用のスタイル --- */
            .stamp-accordion details {
              background-color: #40444b;
              border: 1px solid #555;
              border-radius: 4px;
              margin-bottom: 5px;
            }
            .stamp-accordion summary {
              cursor: pointer;
              padding: 0.5em 1em;
              font-weight: bold;
              outline: none; /* クリック時の青い枠線を消す */
            }
            .stamp-content {
              padding: 1em;
              text-align: center;
              border-top: 1px solid #555;
            }
            .stamp-content img {
              max-width: 100%;
              height: 100px;
              object-fit: contain;
            }
          </style>
        </head>
        <body>
          <h1>${pageTitle} (${publicStickers.length}個)</h1>
          <p>
            /スタンプ 投稿
            で投稿できる公共スタンプの一覧です。通信量を節約するため、見たいスタンプだけを開く形式になっています。
          </p>

          <hr />
          <!-- 水平線で区切ると、さらに見やすい -->

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
                  画像は <strong>320x320px</strong> 以下、<strong>512KB</strong>
                  以下にしてください。
                </li>
                <li>
                  登録は一人<strong>5件</strong>までです。（Mod/ILは50件まで）
                </li>
              </ul>
            </li>
          </ul>

          <h3>公開設定について</h3>
          <p>
            スタンプを「公開」にすると、サーバーの誰もが使えるようになり、この一覧にも掲載されます。<br />
            <strong>PBW納品物</strong
            >などを新規に登録する際は、各会社の利用規約をよくご確認の上、「外部利用ライセンス」などを取得した作品のみを公開設定にすることを、推奨します。
          </p>
          <div class="stamp-accordion">
            ${publicStickers
              .map(
                (sticker) => `
    <details>
      <summary>${sticker.name}</summary>
      <div class="stamp-content">
        <img src="${sticker.imageUrl}" alt="${sticker.name}" loading="lazy">
      </div>
    </details>`
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
