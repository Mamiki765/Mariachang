// handlers/clientReady.mjs
// discord.js v15よりreadyイベントはclientReadyに名称変更されたため、ready.mjsからリネーム
import { EmbedBuilder, ActivityType } from "discord.js";
import cron from "node-cron";
import config from "../config.mjs";
// ロスアカ定期チェック関連
import { checkNewScenarios } from "../tasks/scenario-checker.mjs"; // シナリオの定期チェック
import { checkAtelierCards } from "../tasks/atelier-checker.mjs"; // エクストラカードのチェック
// データベースの同期
import { syncModels } from "../models/database.mjs";
//実績
import { initializeAchievementSystem } from "../utils/achievements.mjs";
//ログボボタン
import { acornLoginButton } from "../components/buttons.mjs";
//発言チップ
import { startPizzaDistribution } from "../tasks/pizza-distributor.mjs";
// Mee6レベル同期タスク
import { syncMee6Levels } from "../tasks/mee6-level-updater.mjs";
import { getSupabaseClient } from "../utils/supabaseClient.mjs";
// package.jsonからバージョンを取得
import { readFileSync } from "node:fs";
//RSSチェッカー
import { initializeRssWatcher } from "../tasks/rss-watcher.mjs";
// package.json を同期で読み込む (起動時のみ)
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8")
);

//250817 noOverlap: true…node-cron3->4から実装、多重実行を防ぐ。ちなみにscheduledは不要になりました。
export default async (client) => {
  console.log("[INIT] Bot is ready. Starting final setup...");
  //node-cron '秒（省略可） 分 時 日 月 曜日'
  // 8時と22時に時報、送信先読み込み
  const timechannel = await client.channels.fetch(config.timesignalch);
  const morningImageUrl =
      "https://cdn.discordapp.com/attachments/1261485824378142760/1421894692391358607/image.png?ex=68dab220&is=68d960a0&hm=4e7367625ea405cb6e3e58f79cd0bbc3e085155ab03721cf9867acf5eac012bf&";
    
  const nightImageUrl =
    "https://cdn.discordapp.com/attachments/1261485824378142760/1421894775795089448/image.png?ex=68dab234&is=68d960b4&hm=e607ae645534b086ae44e8c4438f6434f33afff37521c460dcf36c7f65f92bd4&";
  //8時
  cron.schedule(
    "0 8 * * *",
    async () => {
      await timechannel.send({
        content: `朝の8時をお知らせしますにゃ[。](${morningImageUrl})`,
        components: [acornLoginButton],
      });
      /*SUPABASEに移行したのでコメントアウト　
    sendDatabaseBackup(client).catch((error) => {
      console.error("バックアップの送信に失敗しました:", error);
    });
    */
    },
    {
      noOverlap: true, //多重実行禁止
      timezone: "Asia/Tokyo", // 日本時間を指定
    }
  );
  //22時
  cron.schedule(
    "0 22 * * *",
    async () => {
      await timechannel.send({
        content: `夜の22時をお知らせしますにゃ[。](${nightImageUrl})`,
        components: [acornLoginButton],
      });
    },
    {
      noOverlap: true, //多重実行禁止
      timezone: "Asia/Tokyo", // 日本時間を指定
    }
  );
  //闘技　予選終了
  const arenachannel = await client.channels.fetch(config.arenatimech);
  cron.schedule(
    "0 17 * * 1",
    async () => {
      //250509 14→17時に
      await arenachannel.send(
        "【自動】 [闘技場の予選終了時間です。](<https://rev2.reversion.jp/arena/official>)\n明日10時までAIやステータスを更新することができます。(本戦開始後は大会終了まで更新することができません)\n決勝トーナメント表を確認してください。"
      );
    },
    {
      noOverlap: true, //多重実行禁止
      timezone: "Asia/Tokyo", // 日本時間を指定
    }
  );
  //闘技　ベスト４
  /* 250703ロスアカ本戦以降AIいじれなくなったので削除

  //闘技　準決勝終了

*/
  //闘技　本戦終了
  cron.schedule(
    "0 14 * * 5",
    async () => {
      await arenachannel.send(
        "【自動】 <@&1235859815159562291>\n[闘技場の終了時間です。](<https://rev2.reversion.jp/arena/official>)\n自動継続をしている方はRCの残数の確認を\n自動登録をしていない方は戦術や活性スキル確認の上登録をしてくださいね。"
      );
    },
    {
      noOverlap: true, //多重実行禁止
      timezone: "Asia/Tokyo", // 日本時間を指定
    }
  );
  //闘技　24時間前リマインド
  cron.schedule(
    "0 10 * * 0",
    async () => {
      await arenachannel.send(
        "【自動】 <@&1235859815159562291>\n今週の闘技場の締め切りが残り24時間を切りました。参加をご予定の方は早めの[登録](<https://rev2.reversion.jp/arena/official>)をよろしくお願いします。\nまた作戦(登録された装備やスキル、AI)の確認をお忘れなく！"
      );
    },
    {
      noOverlap: true, //多重実行禁止
      timezone: "Asia/Tokyo", // 日本時間を指定
    }
  );
  // 時報ここまで

  // シナリオ同期前にデータベースの同期が完了するのを待つ！
  try {
    await syncModels();
    console.log(
      "[DB]Database synchronized successfully. Proceeding with tasks."
    );
    //実績とRSSの初期化
    initializeAchievementSystem();
    initializeRssWatcher(client); 
  } catch (error) {
    console.error(
      "[FATAL ERROR][DB]CRITICAL: Database sync failed on startup. Halting scheduled tasks.",
      error
    );
    // 同期に失敗したら、何もせずに関数を終了する
    return;
  }

  //シナリオの定期チェック
  // 最初に一度だけ即時実行
  //　データベースが共通のためデバッグ中は動かないように塞ぐ（通知は差分なので）
  if (config.isProduction) {
    console.log("[TASK] Scenario checker: Performing initial check.");
    checkNewScenarios(client);
    // エクストラカードのチェックも即時実行
    checkAtelierCards(client);
    // ついでにブースターの垢更新も即座にチェック
    console.log("[TASK] Booster Sync: Performing initial synchronization.");
    await synchronizeBoosters(client);
  } else {
    console.log(
      "[TASK] Scenario checker: Initial check skipped in development mode."
    );
  }

  if (config.isProduction) {
    // シナリオ更新が活発な夜間（22時～翌1時）を含め、更新頻度を最適化したスケジュール
    // 設定時間はconfig参照
    cron.schedule(
      config.scenarioChecker.cronSchedule, // configからスケジュールを取得
      () => {
        console.log("[TASK] スケジュールされたシナリオチェックを実行します...");
        checkNewScenarios(client);
      },
      {
        noOverlap: true, //多重実行禁止
        timezone: "Asia/Tokyo", // 日本時間を指定
      }
    );
    // 8:10にシナリオチェックを実行(あまり好きくないけど上とは45分と10分で違うからcronの都合で仕方ない…)
    cron.schedule(
      config.scenarioChecker.cronSchedule2, // configからスケジュールを取得
      () => {
        console.log("[TASK] 8:10のシナリオチェックを実行します...");
        checkNewScenarios(client);
        checkAtelierCards(client); // 8:10はエクストラカードのチェックも同時に実行
      },
      {
        noOverlap: true, //多重実行禁止
        timezone: "Asia/Tokyo", // 日本時間を指定
      }
    );
    // ラリーの期間だけ1時間に１回
    cron.schedule(
      config.scenarioChecker.cronSchedule3, // configからスケジュールを取得
      () => {
        console.log(
          "[TASK] スケジュールされたシナリオチェックを実行します...（増加分）"
        );
        checkNewScenarios(client);
      },
      {
        noOverlap: true, //多重実行禁止
        timezone: "Asia/Tokyo", // 日本時間を指定
      }
    );
  } else {
    console.log(
      "[TASK] Scenario checker tasks are disabled in development mode."
    );
  }
  // -----------------------------------------------------------------
  // Mee6レベル同期タスク
  // 最初に一度実行して、データを最新にする
  syncMee6Levels();

  // その後、1日2回（朝7:50 と 夜19:50）定期実行してデータを更新し続ける
  cron.schedule(
    "50 7,19 * * *",
    () => {
      syncMee6Levels();
    },
    {
      noOverlap: true,
      timezone: "Asia/Tokyo",
    }
  );
  // -----------------------------------------------------------------

  await client.user.setActivity("🍙", {
    type: ActivityType.Custom,
    state: "今日も雨宿り中",
  });
  console.log(`[INFO]${client.user.tag} がログインしました！`);

  // 240718デバッグサーバーにログイン通知
  // 250904名前とバージョンを表示するように変更
  client.channels.cache.get(config.logch.login).send({
    embeds: [
      new EmbedBuilder()
        .setTitle("起動完了")
        .setDescription(
          `> Botが起動しました。\n${packageJson.name} v${packageJson.version}\nサービス名：${process.env.SERVICE_NAME}`
        )
        .setColor("#B78CFE")
        .setTimestamp(),
    ],
  });
  // ログイン通知ここまで
  // 発言によるピザトークン付与および10分ごとの放置ゲー人口増加の定期タスク開始
  startPizzaDistribution();
  console.log("[INIT]チップ配布の定期タスクを開始しました。");
};

/* SUPABASEに移行したのでコメントアウト
かつてはここで破損対策にsqlite3をDiscordに送ってました
// SQLite3データベースのバックアップを送信する関数
async function sendDatabaseBackup(client) {
  try {
    await client.channels.cache.get(config.logch.backup).send({
      content: "SQLite3データベースのバックアップを取得しました。",
      files: [".data/roleplaydb.sqlite3"],
    });
  } catch (error) {
    console.error("バックアップの送信に失敗しました:", error);
    await client.channels.cache.get(config.logch.backup).send({
      content: "⚠️ バックアップの送信に失敗しました。",
    });
  }
}
  */

// ★★★ ブースター同期のための関数を定義 ★★★
async function synchronizeBoosters(client) {
  console.log("[BOOSTER] Synchronizing booster roles...");
  try {
    const supabase = getSupabaseClient();
    const boosterGuilds = Object.keys(config.chatBonus.booster_coin.roles);

    // まず、管理対象サーバーの既存ブースター情報を一度すべて削除
    await supabase
      .from("booster_status")
      .delete()
      .in("guild_id", boosterGuilds);

    let allBoosterData = [];

    for (const guildId of boosterGuilds) {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        console.warn(`[BOOSTER] Guild ${guildId} not found.`);
        continue;
      }

      const roleId = config.chatBonus.booster_coin.roles[guildId];
      // 念のためロールもfetch
      const role = await guild.roles.fetch(roleId).catch(() => null);
      if (!role) {
        console.warn(`[BOOSTER] Role ${roleId} not found in guild ${guildId}.`);
        continue;
      }

      // 全メンバーを強制的に取得して、キャッシュの不完全さを回避
      await guild.members.fetch();

      const membersWithRole = guild.members.cache.filter((member) =>
        member.roles.cache.has(roleId)
      );

      const boosterData = membersWithRole.map((member) => ({
        user_id: member.id,
        guild_id: guild.id,
      }));

      allBoosterData.push(...boosterData);
    }

    if (allBoosterData.length > 0) {
      const { error } = await supabase
        .from("booster_status")
        .upsert(allBoosterData);
      if (error) throw error;
      console.log(
        `[BOOSTER] Successfully synchronized ${allBoosterData.length} boosters.`
      );
    } else {
      console.log("[BOOSTER] No boosters found to synchronize.");
    }
  } catch (error) {
    console.error("[BOOSTER] Error during booster synchronization:", error);
  }
}
