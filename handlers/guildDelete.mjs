import { EmbedBuilder } from "discord.js";

import config from "../config.mjs";
//新規ギルドから外された時の処理

export default async (guild, client) => {
  const delEmbed = new EmbedBuilder()
    .setTitle("サーバー退出")
    .setDescription(`${guild.name}(${guild.id})からBotが退出しました。`)
    .setThumbnail(
      guild.iconURL({
        dynamic: true,
      })
    )
    .setColor("#ff0000")
    .setTimestamp();
  const logChannel = client.channels.cache.get(config.logch.guildDelete);
  if (logChannel) {
    logChannel
      .send({
        embeds: [delEmbed],
      })
      .catch(console.error);
  } else {
    console.error("ログチャンネルが見つかりませんでした。");
  }
};

/*
処理ここまで、以下サブルーチン
*/
