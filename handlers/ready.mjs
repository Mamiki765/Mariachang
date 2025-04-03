import { EmbedBuilder, ActivityType } from "discord.js";
import cron from "node-cron";
import config from "../config.mjs";

export default async (client) => {
  // 8時と22時に時報、送信先読み込み
  const timechannel = await client.channels.fetch(config.timesignalch);
  //8時
  cron.schedule("0 8 * * *", async () => {
    await timechannel.send("朝の8時をお知らせしますにゃ。");
    sendDatabaseBackup(client).catch((error) => {
      console.error("バックアップの送信に失敗しました:", error);
    });
  });
  //22時
  cron.schedule("0 22 * * *", async () => {
    await timechannel.send("夜の22時をお知らせしますにゃ。");
    // バックアップは非同期で実行し、処理が遅れないようにする
    sendDatabaseBackup(client).catch((error) => {
      console.error("バックアップの送信に失敗しました:", error);
    });
  });
  // 時報ここまで

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
        .setDescription("> Botが起動しました。")
        .setColor("#B78CFE")
        .setTimestamp(),
    ],
  });
  // ログイン通知ここまで
};

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
