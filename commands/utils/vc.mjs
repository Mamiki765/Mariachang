// commands/utils/vc.mjs
import { 
    SlashCommandBuilder, 
    PermissionsBitField, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ChannelSelectMenuBuilder 
} from "discord.js";
import {
    joinVoiceChannel,
    getVoiceConnection,
    createAudioPlayer,
    NoSubscriberBehavior,
    createAudioResource,
    AudioPlayerStatus
} from "@discordjs/voice";
import Sequelize from "sequelize";
import { Notification } from "../../models/database.mjs";
import { Readable } from "stream";
import * as googleTTS from 'google-tts-api'; 

export const voiceSessions = new Map();

// ヘルプ用データ
export const help = {
    category: "slash",
    subcommands:[
        { name: "join", description: "マリアをVCに呼び出します。" },
        { name: "leave", description: "マリアをVCから退出させます。" },
        { name: "settings autojoin", description: "自動入室・通知の設定（管理者専用）" },
        { name: "settings status", description: "設定の確認（管理者専用）" },
        { name: "settings list", description: "全設定のリスト（管理者専用）" },
        { name: "settings delete", description: "設定の削除（管理者専用）" },
    ],
};

// 👨‍🏫 【コマンド定義】3階層で綺麗に整理！
export const data = new SlashCommandBuilder()
    .setName("vc")
    .setDescription("ボイスチャンネル操作と読み上げ設定")
    // 第2階層：通常コマンド
    .addSubcommand(sub => sub.setName("join").setDescription("参加して読み上げを開始するにゃ"))
    .addSubcommand(sub => sub.setName("leave").setDescription("退出するにゃ"))
    // 第2階層：サブコマンドグループ（設定）
    .addSubcommandGroup(group => group
        .setName("settings")
        .setDescription("自動入室・通知の設定（管理者専用）")
        .addSubcommand(sub => sub
            .setName("status")
            .setDescription("このチャンネルの自動入室・通知設定を確認するよ～")
        )
        .addSubcommand(sub => sub
            .setName("list")
            .setDescription("サーバー内のすべての設定を確認するよ～")
        )
        .addSubcommand(sub => sub
            .setName("autojoin")
            .setDescription("自動入室と読み上げを設定するよ～")
            // 👨‍🏫 【追加】通知ON/OFFの選択肢
            .addBooleanOption(opt => opt
                .setName("send_message")
                .setDescription("通話開始時に「〇〇さんが開始したにゃ！」と通知するか")
                .setRequired(true)
            )
        )
        .addSubcommand(sub => sub
            .setName("delete")
            .setDescription("ボイスチャンネル入室通知の設定を削除するよ～")
        )
    );

export async function execute(interaction) {
    const subcommandGroup = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const botId = interaction.client.user.id;

    // ==========================================
    // 1. 通常コマンド (/vc join, /vc leave)
    // ==========================================
    if (!subcommandGroup) {
        if (subcommand === "join") {
            const channel = interaction.member.voice.channel;
            if (!channel) return interaction.reply({ content: "VCに入ってにゃ！", flags: 64 });

            // すでに接続中かチェック（寝取られ防止）
            const existingConnection = getVoiceConnection(guildId);
            if (existingConnection) {
                if (existingConnection.joinConfig.channelId === channel.id) {
                     return interaction.reply({ content: "もうここにいるにゃ！", flags: 64 });
                } else {
                     return interaction.reply({ content: "今は別のチャンネルでお仕事中だにゃ！", flags: 64 });
                }
            }

            const notifications = await Notification.findAll({
                where: { guildId, voiceChannelId: channel.id }
            });

            const targetTextChannels = notifications.map(n => n.textChannelId);
            targetTextChannels.push(channel.id); // VC自体のテキストも対象にする

            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: guildId,
                adapterCreator: interaction.guild.voiceAdapterCreator,
            });

            const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
            
            // 次の音声を再生するイベント
            player.on(AudioPlayerStatus.Idle, () => {
                playNextAudio(guildId, botId);
            });
            player.on('error', (error) => {
                console.error('[VoiceVox Player Error]', error.message);
                playNextAudio(guildId, botId);
            });

            connection.subscribe(player);

            if (!voiceSessions.has(guildId)) voiceSessions.set(guildId, {});
            voiceSessions.get(guildId)[botId] = {
                player,
                voiceChannelId: channel.id,
                targetTextChannels:[...new Set(targetTextChannels)],
                queue:[],
                isPlaying: false
            };

            await interaction.reply(`<#${channel.id}> に参加したにゃ！読み上げを開始するにゃ。`);
            // おまけ：入室挨拶を読み上げるならここ
            // enqueueAudio(guildId, botId, "マリアが参加したにゃ！");

        } else if (subcommand === "leave") {
            const connection = getVoiceConnection(guildId);
            if (connection) connection.destroy();

            const guildSessions = voiceSessions.get(guildId);
            if (guildSessions) {
                if (guildSessions[botId]?.player) guildSessions[botId].player.stop();
                delete guildSessions[botId];
                if (Object.keys(guildSessions).length === 0) voiceSessions.delete(guildId);
            }
            await interaction.reply("退出したにゃ！");
        }
        return;
    }

    // ==========================================
    // 2. 設定コマンド (/vc settings ...)
    // ==========================================
    if (subcommandGroup === "settings") {
        // 👨‍🏫 管理者権限チェック！ (旧 notify.mjs の代替)
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: "このコマンドは管理者専用にゃ！", flags: 64 });
        }

        if (subcommand === "status") {
            const notifications = await Notification.findAll({
                where: { guildId, textChannelId: interaction.channelId },
            });

            if (notifications.length === 0) return interaction.reply("設定は見つかりませんでした。");

            // 通知のON/OFFも表示するように拡張
            const channelsArr = notifications.map(n => `・<#${n.voiceChannelId}> (通知: ${n.sendNotifyMessage ? "ON" : "OFF"})`);
            
            const embed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle(`<#${interaction.channelId}> の自動入室・通知設定`)
                .setDescription(channelsArr.join("\n"));

            await interaction.reply({ embeds: [embed] });

        } else if (subcommand === "list") {
            // 旧 list の処理そのまま
            const notificationTextChannels = await Notification.findAll({
                where: { guildId: interaction.guildId },
                attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("textChannelId")), "textChannelId"]],
            });

            if (notificationTextChannels.length === 0) return interaction.reply("設定は見つかりませんでした。");

            const embeds = await Promise.all(notificationTextChannels.map(async (n) => {
                const notifications = await Notification.findAll({
                    where: { guildId: interaction.guildId, textChannelId: n.textChannelId },
                });
                const channelsArr = notifications.map(notif => `・<#${notif.voiceChannelId}> (通知: ${notif.sendNotifyMessage ? "ON" : "OFF"})`);
                return new EmbedBuilder()
                    .setColor(0x0099ff)
                    .setTitle(`<#${n.textChannelId}> に関連付けられたVC設定`)
                    .setDescription(channelsArr.join("\n"));
            }));

            await interaction.reply({ embeds: embeds });

        } else if (subcommand === "autojoin") {
            // 👨‍🏫 ユーザーが選んだ true / false を取得
            const isSendNotify = interaction.options.getBoolean("send_message");

            try {
                const voiceChannelSelect = new ChannelSelectMenuBuilder()
                    .setCustomId("selectVoiceChannel")
                    .setChannelTypes("GuildVoice")
                    .setMaxValues(20);

                const notifications = await Notification.findAll({
                    where: { guildId, textChannelId: interaction.channelId },
                });

                if (notifications.length !== 0) {
                    notifications.map((n) => voiceChannelSelect.addDefaultChannels(n.voiceChannelId));
                }

                const voiceChannelrow = new ActionRowBuilder().addComponents(voiceChannelSelect);

                const response = await interaction.reply({
                    content: `チェックしたいボイスチャンネルを選んでね（通知メッセージ: **${isSendNotify ? "ON" : "OFF"}**）\n※メニューを閉じると確定します`,
                    components: [voiceChannelrow],
                });

                const collectorFilter = (i) => i.customId === "selectVoiceChannel" && i.user.id === interaction.user.id;
                const collector = response.createMessageComponentCollector({ collectorFilter, time: 30000 });

                collector.on("collect", async (collectedInteraction) => {
                    await Notification.destroy({ where: { textChannelId: interaction.channelId } });
                    
                    const channelsArr = await Promise.all(collectedInteraction.values.map(async (voiceChannelId) => {
                        // 👨‍🏫 データベースに boolean を保存！
                        await Notification.create({
                            guildId: interaction.guildId,
                            voiceChannelId: voiceChannelId,
                            textChannelId: interaction.channelId,
                            sendNotifyMessage: isSendNotify // ← ここで保存
                        });
                        return "<#" + voiceChannelId + ">";
                    }));

                    const embed = new EmbedBuilder()
                        .setColor(0x5cb85c)
                        .setTitle(`<#${interaction.channelId}> の設定完了`)
                        .setDescription(`通知メッセージ: **${isSendNotify ? "ON" : "OFF"}**\n${channelsArr.join("\n")}`);

                    await collectedInteraction.update({ content: `設定完了～👍`, embeds: [embed], components:[] });
                });
            } catch (e) {
                await interaction.editReply({ content: "時間切れ～(もしくはエラー)", components:[] });
            }

        } else if (subcommand === "delete") {
            await Notification.destroy({ where: { textChannelId: interaction.channelId } });
            await interaction.reply("削除完了～👍");
        }
    }
}

// ==========================================
// 外部公開する読み上げ受付関数
// ==========================================
export async function enqueueAudio(guildId, botId, text) {
    const session = voiceSessions.get(guildId)?.[botId];
    if (!session) return;

    let cleanText = text
        .replace(/https?:\/\/\S+/g, "URL省略")
        .replace(/<@[!&]?\d+>/g, "")
        .replace(/<a?:[\w]+:\d+>/g, "")
        .trim();

    if (cleanText.length === 0) return;
    
    // 全体で60文字を超えたら「以下略」にする
    if (cleanText.length > 60) {
        cleanText = cleanText.substring(0, 60) + "、以下略";
    }

    // 👨‍🏫 【工夫】文章を「改行」や「句読点（。！？、）」で細かく区切る！
    // 例：「寿限無、寿限無」→「寿限無、」と「寿限無」に分割される
    const parts = cleanText.split(/(?<=[。！？、\n])/g).filter(p => p.trim().length > 0);

    // 短くなったパーツを順番にキューに入れる
    for (const part of parts) {
        session.queue.push(part.trim());
    }

    // 再生開始
    if (!session.isPlaying) {
        playNextAudio(guildId, botId);
    }
}

// ==========================================
// 内部処理: 音声再生
// ==========================================
export async function playNextAudio(guildId, botId) {
    const session = voiceSessions.get(guildId)?.[botId];
    if (!session) return;

    if (session.queue.length === 0) {
        session.isPlaying = false;
        return;
    }

    session.isPlaying = true;
    const text = session.queue.shift();

    try {
        // Google TTSから音声URLを取得（200文字以内推奨）
        const url = googleTTS.getAudioUrl(text, {
            lang: 'ja',
            slow: false,
            host: 'https://translate.google.com',
        });

        const resource = createAudioResource(url);
        session.player.play(resource);

    } catch (err) {
        console.error("[Reading Error]", err.message);
        playNextAudio(guildId, botId);
    }
}