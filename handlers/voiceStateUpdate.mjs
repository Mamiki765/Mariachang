// handlers/voiceStateUpdate.mjs
import { EmbedBuilder } from "discord.js";
import { joinVoiceChannel, getVoiceConnection, createAudioPlayer, NoSubscriberBehavior } from "@discordjs/voice";
import { Notification } from "../models/database.mjs";
import { voiceSessions } from "../commands/utils/vc.mjs";

export default async (oldState, newState) => {
  const guildId = newState.guild.id;
  const botId = newState.client.user.id;
  const session = voiceSessions.get(guildId)?.[botId];

  // --- 1. 移動先への参加・移動判定 ---
  // 誰かがVCに入った、または移動してきた 
  // かつ、そのVCに（Botを除いて）1人しかいない
  if (newState.channelId && newState.channel.members.filter(m => !m.user.bot).size === 1) {

    // マリアがまだそのVCにいない場合のみ実行
    if (!session || session.voiceChannelId !== newState.channelId) {

      const notifications = await Notification.findAll({
        where: { guildId, voiceChannelId: newState.channelId },
      });

      if (notifications.length > 0) {
        const textChannelIds = notifications.map(n => n.textChannelId);
        const combinedTargetChannels = [...new Set([...textChannelIds, newState.channelId])];

        // 通知の送信
        const embed = new EmbedBuilder()
          .setColor(0x5cb85c)
          .setAuthor({ name: newState.member.displayName, iconURL: newState.member.displayAvatarURL() })
          .setTitle(`<#${newState.channelId}> で通話を開始したにゃ！`)

        await Promise.all(combinedTargetChannels.map(async (id) => {
          const ch = await newState.guild.channels.fetch(id).catch(() => null);
          if (ch) ch.send({ embeds: [embed] }).catch(() => { });
        }));

        // 接続・移動
        const connection = joinVoiceChannel({
          channelId: newState.channelId,
          guildId: guildId,
          adapterCreator: newState.guild.voiceAdapterCreator,
        });

        // すでにPlayerがある場合は再利用、なければ新規作成
        let player = session?.player;
        if (!player) {
          player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
        }
        connection.subscribe(player);

        // Map情報の更新
        if (!voiceSessions.has(guildId)) voiceSessions.set(guildId, {});
        voiceSessions.get(guildId)[botId] = {
          player,
          voiceChannelId: newState.channelId,
          targetTextChannels: combinedTargetChannels
        };
      }
    }
  }

  // --- 2. 移動元（誰もいなくなったVC）からの退出判定 ---
  // 誰かがVCから出た、または移動した
  if (oldState.channelId) {
    const remainingMembers = oldState.channel.members.filter(m => !m.user.bot);

    // Bot以外に誰もいなくなった場合
    if (remainingMembers.size === 0) {
      // かつ、マリアが今そこにいる場合
      if (session && session.voiceChannelId === oldState.channelId) {
        const connection = getVoiceConnection(guildId);
        if (connection) connection.destroy();

        // セッションを削除（この書き方なら確実です）
        const guildSessions = voiceSessions.get(guildId);
        if (guildSessions) {
          delete guildSessions[botId];
          if (Object.keys(guildSessions).length === 0) {
            voiceSessions.delete(guildId);
          }
        }
      }
    }
  }
};