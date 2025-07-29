// scenario.mjs
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import puppeteer from "puppeteer"; // Playwrightを使う場合は 'playwright' に変更

export const data = new SlashCommandBuilder()
  .setName("scenario")
  .setNameLocalizations({
    ja: "テスト中",
  })
  .setDescription("Lost Arcadiaのシナリオ一覧を取得します。");

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true }); // 処理に時間がかかるのでDeferred Replyを使用

  let browser;
  try {
    // --- Puppeteerの起動とメモリ最適化設定 ---
    browser = await puppeteer.launch({
      headless: "new", // 最新のヘッドレスモードを使用
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage", // メモリ不足対策
        "--single-process", // シングルプロセスモードでメモリ節約
        "--disable-accelerated-mhtml-generation", // メモリ消費を抑える可能性
        "--disable-features=IsolateOrigins,site-per-process", // メモリ使用量を削減する可能性
        "--incognito", // シークレットモードでキャッシュを無効化
      ],
      // puppeteer-coreを使用する場合や、特定のChromiumパスを指定する場合
      // executablePath: 'パス/to/chromium'
    });
    const page = await browser.newPage();

    // --- 不要なリソースのブロック ---
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      // 画像、CSS、フォント、メディア、ウェブソケットなど、不要なリソースをブロック
      if (
        ["image", "stylesheet", "font", "media", "websocket"].indexOf(
          request.resourceType()
        ) !== -1
      ) {
        request.abort();
      } else {
        request.continue();
      }
    });

    await page.goto("https://rev2.reversion.jp/scenario", {
      waitUntil: "domcontentloaded", // DOMContentLoadedで待機し、余計なリソース読み込みを削減
      timeout: 30000, // タイムアウト設定（30秒）
    });

    // --- シナリオ情報の抽出 ---
    const scenarioData = await page.evaluate(() => {
      const results = [];
      // 各シナリオのアイテムは '.scenario-panel' クラスを持つ `<a>` タグで囲まれています
      const scenarioElements = document.querySelectorAll(
        'a[href*="/scenario/opening/sce"]'
      ); // `a` タグかつhrefがscenario/opening/sceで始まるもの

      scenarioElements.forEach((element) => {
        // 各情報のセレクタをHTMLに合わせて調整
        const href = element.getAttribute("href");
        const scenarioId = href ? href.split("/").pop() : null; // "sce00003593" のようなIDを取得

        // シナリオグループ名 (例: 町田行軍)
        const scenarioGroupElement = element.querySelector(
          ".scenario-item-subtitle"
        );
        const scenarioGroup = scenarioGroupElement
          ? scenarioGroupElement.textContent.trim()
          : "N/A";

        // タイトル (例: ひまわり畑でつかまえないで)
        const titleElement = element.querySelector(".scenario-item-title");
        const title = titleElement ? titleElement.textContent.trim() : "N/A";

        // 執筆者 (例: 黒筆墨汁) - 本の絵文字はtextContentに含まれないので問題なし
        const authorElement = element.querySelector(".creator-content");
        const author = authorElement ? authorElement.textContent.trim() : "N/A";

        // 日時 (例: 7月30日 22時15分 予約抽選)
        const dateElement = element.querySelector(
          ".scenario-item-date > div:first-child"
        );
        const date = dateElement ? dateElement.textContent.trim() : "N/A";

        // 抽選カテゴリー (例: デフォルト)
        // SVGアイコンを含むため、テキストコンテンツから取得
        const categoryElement = element.querySelector(
          ".scenario-item-date a > span"
        );
        const category = categoryElement
          ? categoryElement.textContent.trim()
          : "N/A";

        // 最大参加人数 (例: 10)
        // SVGアイコンの次にあるテキストとして取得
        const maxParticipantsElement = element.querySelector(
          ".scenario-item-member-max"
        );
        const maxParticipants = maxParticipantsElement
          ? maxParticipantsElement.textContent.replace(/[^0-9]/g, "").trim()
          : "N/A"; // 数字のみ抽出

        // 状態 (例: 予約期間中)
        const statusElement = element.querySelector(
          ".scenario-item-member-state"
        );
        const status = statusElement ? statusElement.textContent.trim() : "N/A";

        // 種別 (例: スタンダードEX)
        // '.scenario-item-tail-item' の2番目の `div` が値を持つ
        const typeElement = element.querySelector(
          ".scenario-item-tail-item:nth-child(1) > div:last-child"
        );
        const type = typeElement ? typeElement.textContent.trim() : "N/A";

        // 難易度 (例: HARD)
        const difficultyElement = element.querySelector(
          ".scenario-item-tail-item:nth-child(2) > div:last-child"
        );
        const difficulty = difficultyElement
          ? difficultyElement.textContent.trim()
          : "N/A";

        // 相談日数 (例: 7日)
        const consultationDaysElement = element.querySelector(
          ".scenario-item-tail-item:nth-child(3) > div:last-child"
        );
        const consultationDays = consultationDaysElement
          ? consultationDaysElement.textContent.trim()
          : "N/A";

        // 参加予約費 (例: 200 RC)
        const rcElement = element.querySelector(
          ".scenario-item-tail-item:nth-child(4) > div:last-child"
        );
        const rc = rcElement ? rcElement.textContent.trim() : "N/A";

        results.push({
          id: scenarioId,
          scenarioGroup: scenarioGroup,
          title: title,
          author: author,
          date: date,
          category: category,
          maxParticipants: maxParticipants,
          status: status,
          type: type,
          difficulty: difficulty,
          consultationDays: consultationDays,
          rc: rc,
        });
      });
      return results;
    });

    // --- 取得した情報からDiscord Embedを生成 ---
    if (scenarioData.length === 0) {
      await interaction.editReply({
        content: "シナリオ情報が見つかりませんでした。",
        ephemeral: true,
      });
      return;
    }

    // タイトルと執筆者の一覧を作成
    let displayList = "";
    scenarioData.slice(0, 10).forEach((s, index) => {
      // とりあえず最初の10件を表示
      displayList += `${index + 1}. **${s.title}** (執筆者: ${s.author})\n`;
    });

    const embed = new EmbedBuilder()
      .setTitle("Lost Arcadia シナリオ一覧 (一部)")
      .setDescription(displayList || "取得したシナリオがありませんでした。")
      .setColor("#0099ff")
      .setTimestamp()
      .setFooter({ text: "最新の情報です。" });

    await interaction.editReply({
      embeds: [embed],
      ephemeral: true,
    });
  } catch (error) {
    console.error("シナリオ取得中にエラーが発生しました:", error);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({
        content:
          "シナリオの取得中にエラーが発生しました。時間を置いて再度お試しください。",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content:
          "シナリオの取得中にエラーが発生しました。時間を置いて再度お試しください。",
        ephemeral: true,
      });
    }
  } finally {
    if (browser) {
      await browser.close(); // ブラウザインスタンスを必ず閉じる
    }
  }
}
