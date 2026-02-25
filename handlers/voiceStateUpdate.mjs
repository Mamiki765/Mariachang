// handlers/voiceStateUpdate.mjs
import { EmbedBuilder } from "discord.js";
import { joinVoiceChannel, getVoiceConnection, createAudioPlayer, NoSubscriberBehavior, AudioPlayerStatus } from "@discordjs/voice"; // 👨‍🏫 AudioPlayerStatus 追加
import { Notification } from "../models/database.mjs";
// 👨‍🏫 playNextAudio をインポート
import { voiceSessions, playNextAudio } from "../commands/utils/vc.mjs"; 

export default async (oldState, newState) => {
  const guildId = newState.guild.id;
  const botId = newState.client.user.id;
  const session = voiceSessions.get(guildId)?.[botId];

  // --- 1. 移動先への参加・移動判定 ---
  // 誰かがVCに入った、または移動してきた 
  // かつ、そのVCに（Botを除いて）1人しかいない
  if (newState.channelId && newState.channel.members.filter(m => !m.user.bot).size === 1) {

    // 👨‍🏫 【寝取られ防止！】 マリアがすでに別のVCでお仕事中なら、何もしないで帰る
    if (session && session.voiceChannelId !== newState.channelId) {
      console.log(`[Voice] ${newState.channel.name} に人が来ましたが、マリアは別VCで稼働中のため無視します。`);
      return; 
    }

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
          .setTitle(`<#${newState.channelId}> で通話を開始したにゃ！`);

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
          
          // 👨‍🏫 【重要】自動で作ったプレイヤーにも「次を再生する」監視をつける
          player.on(AudioPlayerStatus.Idle, () => {
            playNextAudio(guildId, botId);
          });
          player.on('error', (error) => {
            console.error('[VoiceVox Player Error]', error.message);
            playNextAudio(guildId, botId);
          });
        }
        connection.subscribe(player);

        // Map情報の更新
        if (!voiceSessions.has(guildId)) voiceSessions.set(guildId, {});
        voiceSessions.get(guildId)[botId] = {
          player,
          voiceChannelId: newState.channelId,
          targetTextChannels: combinedTargetChannels,
          queue:[],        // 👨‍🏫 追加: キューの初期化
          isPlaying: false  // 👨‍🏫 追加: 再生フラグの初期化
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

        // 👨‍🏫 (おまけ) 念のためプレイヤーを止めておく
        if (session.player) session.player.stop();

        // セッションを削除
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