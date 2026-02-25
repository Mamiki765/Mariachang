// handlers/voiceStateUpdate.mjs
import { EmbedBuilder } from "discord.js";
import { joinVoiceChannel, getVoiceConnection, createAudioPlayer, NoSubscriberBehavior } from "@discordjs/voice";
import { Notification } from "../models/database.mjs";
import { voiceSessions } from "../commands/utils/vc.mjs";

export default async (oldState, newState) => {
  const guildId = newState.guild.id;
  const botId = newState.client.user.id;

  // --- 自動入室ロジック (入室) ---
  if (oldState.channelId === null && newState.channel?.members.size === 1) {
    const voiceChannelId = newState.channel.id;
    const notifications = await Notification.findAll({ where: { guildId, voiceChannelId } });

    if (notifications.length > 0) {
      const textChannelIds = notifications.map(n => n.textChannelId);
      
      // 通知送信 (省略版)
      const embed = new EmbedBuilder().setColor(0x5cb85c).setTitle(`<#${voiceChannelId}> で通話開始！`);
      await Promise.all(textChannelIds.map(async id => {
        const ch = await newState.guild.channels.fetch(id);
        ch.send({ embeds: [embed] }).catch(() => {});
      }));

      // 接続
      const connection = joinVoiceChannel({
        channelId: voiceChannelId,
        guildId: guildId,
        adapterCreator: newState.guild.voiceAdapterCreator,
      });
      const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
      connection.subscribe(player);

      // Map保存
      if (!voiceSessions.has(guildId)) voiceSessions.set(guildId, {});
      voiceSessions.get(guildId)[botId] = {
          player,
          voiceChannelId,
          targetTextChannels: textChannelIds
      };
    }
  }

  // --- 自動退出ロジック (TODOの書き換え) ---
  // oldState.channelがある ＝ 誰かがVCから出た or 移動した
  if (oldState.channelId) {
    // そのVCに残っている「Bot以外のメンバー」を数える
    const remainingMembers = oldState.channel.members.filter(m => !m.user.bot);
    
    if (remainingMembers.size === 0) {
      // そのサーバーで稼働中のこのBotのセッションを確認
      const session = voiceSessions.get(guildId)?.[botId];
      
      // Botが今まさに「誰もいなくなったチャンネル」にいるなら退出
      if (session && session.voiceChannelId === oldState.channelId) {
        const connection = getVoiceConnection(guildId);
        if (connection) connection.destroy();

        // Mapから削除
        delete voiceSessions.get(guildId)[botId];
        if (Object.keys(voiceSessions.get(guildId)).length === 0) voiceSessions.delete(guildId);
        
        console.log(`[Auto-Leave] Left VC in ${guildId} because it became empty.`);
      }
    }
  }
};