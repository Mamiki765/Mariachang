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
  //闘技　予選終了
  const arenachannel = await client.channels.fetch(config.arenatimech);
  cron.schedule("0 14 * * 1", async () => {
    await arenachannel.send(
      "【自動】 [闘技場の予選終了時間です。](<https://rev2.reversion.jp/arena/official>)\n本戦開始までAIやステータスを更新することができます。\n決勝トーナメント表を確認してください。"
    );
  });
    //闘技　ベスト４
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
        .setDescription("> Botが起動しました。\nサービス名：${process.env.SERVICE_NAME}")
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
