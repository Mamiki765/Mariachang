// handlers/ready.mjs
import { EmbedBuilder, ActivityType } from "discord.js";
import cron from "node-cron";
import config from "../config.mjs";
// ロスアカ定期チェック関連
import { checkNewScenarios } from "../tasks/scenario-checker.mjs"; // シナリオの定期チェック
import { checkAtelierCards } from "../tasks/atelier-checker.mjs"; // エクストラカードのチェック
// データベースの同期
import { syncModels } from "../models/database.mjs";

export default async (client) => {
  console.log("Bot is ready. Starting final setup...");
  //node-cron '秒（省略可） 分 時 日 月 曜日'
  // 8時と22時に時報、送信先読み込み
  const timechannel = await client.channels.fetch(config.timesignalch);
  //8時
  cron.schedule("0 8 * * *", async () => {
    await timechannel.send("朝の8時をお知らせしますにゃ。");
    /*SUPABASEに移行したのでコメントアウト
    sendDatabaseBackup(client).catch((error) => {
      console.error("バックアップの送信に失敗しました:", error);
    });
    */
  });
  //22時
  cron.schedule("0 22 * * *", async () => {
    await timechannel.send("夜の22時をお知らせしますにゃ。");
    // バックアップは非同期で実行し、処理が遅れないようにする
    /*SUPABASEに移行したのでコメントアウト
    sendDatabaseBackup(client).catch((error) => {
      console.error("バックアップの送信に失敗しました:", error);
    });
    */
  });
  //闘技　予選終了
  const arenachannel = await client.channels.fetch(config.arenatimech);
  cron.schedule("0 17 * * 1", async () => {
    //250509 14→17時に
    await arenachannel.send(
      "【自動】 [闘技場の予選終了時間です。](<https://rev2.reversion.jp/arena/official>)\n明日10時までAIやステータスを更新することができます。(本戦開始後は大会終了まで更新することができません)\n決勝トーナメント表を確認してください。"
    );
  });
  //闘技　ベスト４
  /* 250703ロスアカ本戦以降AIいじれなくなったので削除
  cron.schedule("0 14 * * 2", async () => {
    await arenachannel.send(
      "【自動】 [火曜日の闘技場終了時間です。](<https://rev2.reversion.jp/arena/official>)\nベスト４に残った人は準決勝開始までAIやステータスを更新することができます。"
    );
  });
  //闘技　準決勝終了
  cron.schedule("0 14 * * 3", async () => {
    await arenachannel.send(
      "【自動】 [準決勝終了時間です。](<https://rev2.reversion.jp/arena/official>)\nベスト４に残った人は3位決定戦・決勝戦の作戦を送信しましょう。"
    );
  });
*/
  //闘技　本戦終了
  cron.schedule("0 14 * * 5", async () => {
    await arenachannel.send(
      "【自動】 <@&1235859815159562291>\n[闘技場の終了時間です。](<https://rev2.reversion.jp/arena/official>)\n自動継続をしている方はRCの残数の確認を\n自動登録をしていない方は戦術や活性スキル確認の上登録をしてくださいね。"
    );
  });
  //闘技　24時間前リマインド
  cron.schedule("0 10 * * 0", async () => {
    await arenachannel.send(
      "【自動】 <@&1235859815159562291>\n今週の闘技場の締め切りが残り24時間を切りました。参加をご予定の方は早めの[登録](<https://rev2.reversion.jp/arena/official>)をよろしくお願いします。\nまた作戦(登録された装備やスキル、AI)の確認をお忘れなく！"
    );
  });
  // 時報ここまで

  // シナリオ同期前にデータベースの同期が完了するのを待つ！
  try {
    await syncModels();
    console.log("Database synchronized successfully. Proceeding with tasks.");
  } catch (error) {
    console.error(
      "CRITICAL: Database sync failed on startup. Halting scheduled tasks.",
      error
    );
    // 同期に失敗したら、何もせずに関数を終了する
    return;
  }

  //シナリオの定期チェック
  // 最初に一度だけ即時実行
  checkNewScenarios(client);
  // エクストラカードのチェックも即時実行
  checkAtelierCards(client);

// シナリオ更新が活発な夜間（22時～翌1時）を含め、更新頻度を最適化したスケジュール
// 設定時間はconfig参照
  cron.schedule(
    config.scenarioChecker.cronSchedule, // configからスケジュールを取得
    () => {
      console.log("スケジュールされたシナリオチェックを実行します...");
      checkNewScenarios(client);
    },
    {
      scheduled: true,
      timezone: "Asia/Tokyo", // 日本時間を指定
    }
  );
  // 8:10にシナリオチェックを実行(あまり好きくないけど上とは45分と10分で違うからcronの都合で仕方ない…)
  cron.schedule(
    config.scenarioChecker.cronSchedule2, // configからスケジュールを取得
    () => {
      console.log("8:10のシナリオチェックを実行します...");
      checkNewScenarios(client);
      checkAtelierCards(client); // 8:10はエクストラカードのチェックも同時に実行
    },
    {
      scheduled: true,
      timezone: "Asia/Tokyo", // 日本時間を指定
    }
  );

  await client.user.setActivity("🍙", {
    type: ActivityType.Custom,
    state: "今日も雨宿り中",
  });
  console.log(`${client.user.tag} がログインしました！`);

  // 240718管理室にログイン通知
  client.channels.cache.get(config.logch.login).send({
    embeds: [
      new EmbedBuilder()
        .setTitle("起動完了")
        .setDescription(
          `> Botが起動しました。\nサービス名：${process.env.SERVICE_NAME}`
        )
        .setColor("#B78CFE")
        .setTimestamp(),
    ],
  });
  // ログイン通知ここまで
};

/* SUPABASEに移行したのでコメントアウト
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
