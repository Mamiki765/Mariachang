import { EmbedBuilder , ActivityType} from 'discord.js';
import cron from 'node-cron';
import config from '../config.mjs'; 

export default async (client) => {
  // 8時と22時に時報
  const timechannel = await client.channels.fetch(config.timesignalch);
  await cron.schedule('0 8 * * *', () => {
    timechannel.send(`朝の8時をお知らせしますにゃ。`);
  });
  await cron.schedule('0 22 * * *', () => {
    timechannel.send(`夜の22時をお知らせしますにゃ。`);
  });
  // 時報ここまで

  await client.user.setActivity('🍙', { type: ActivityType.Custom, state: "今日も雨宿り中" });
  console.log(`${client.user.tag} がログインしました！`);

  // 240718管理室にログイン通知
  client.channels.cache.get(config.logch.login).send({
    embeds: [
      new EmbedBuilder()
        .setTitle("起動完了")
        .setDescription("> Botが起動しました。")
        .setColor("#B78CFE")
        .setTimestamp()
    ]
  });
  // ログイン通知ここまで
};