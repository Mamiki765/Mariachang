// handlers/voiceStateUpdate.mjs
import { EmbedBuilder } from "discord.js";

import { Notification } from "../models/database.mjs";

export default async (oldState, newState) => {
  if (oldState.channelId === null && newState.channel?.members.size == 1) {
    const notifications = await Notification.findAll({
      where: {
        guildId: newState.guild.id,
        voiceChannelId: newState.channel.id,
      },
    });

    const embed = new EmbedBuilder()
      .setColor(0x5cb85c)
      .setAuthor({
        name: newState.member.displayName,
        iconURL: newState.member.displayAvatarURL(),
      })
      .setTitle(`<#${newState.channel.id}> で通話を開始しました！`)
      .setDescription(`-# 読み上げが止まった時はvoicecordの/config listで文字数を確認してください。有料で誰でも文字数を追加することもできます。`)
      .setTimestamp();

    await Promise.all(
      notifications.map(async (n) => {
        const channel = await newState.guild.channels.fetch(n.textChannelId);
        await channel.send({
          embeds: [embed],
        });
      })
    );
  }
};
