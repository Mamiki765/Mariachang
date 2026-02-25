import { SlashCommandBuilder } from "discord.js";
import {
    joinVoiceChannel,
    getVoiceConnection,
    createAudioPlayer,
    NoSubscriberBehavior
} from "@discordjs/voice";
import { Notification } from "../../models/database.mjs";

export const voiceSessions = new Map();

export const help = {
    category: "slash",
    subcommands: [
        {
            name: "join",
            description: "マリアをVCに呼び出します。",
            notes: "設定されているテキストチャンネルの読み上げを開始します。",
        },
        {
            name: "leave",
            description: "マリアをVCから退出させます。",
        },
    ],
};

export const data = new SlashCommandBuilder()
    .setName("vc")
    .setDescription("ボイスチャンネル操作")
    .addSubcommand(sub => sub.setName("join").setDescription("参加"))
    .addSubcommand(sub => sub.setName("leave").setDescription("退出"));

export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const botId = interaction.client.user.id;

    if (subcommand === "join") {
        const channel = interaction.member.voice.channel;
        if (!channel) return interaction.reply({ content: "VCに入ってにゃ！", flags: 64 });

        // 1. Notificationテーブルから通知先テキストチャンネルを取得
        const notifications = await Notification.findAll({
            where: { guildId, voiceChannelId: channel.id }
        });

        // 2. 読み上げ対象リストを作成 (通知先リスト + VC内蔵テキストチャンネル)
        const targetTextChannels = notifications.map(n => n.textChannelId);
        targetTextChannels.push(channel.id); // VC自体のIDが内蔵テキストチャンネルのIDと同じ

        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator,
        });

        const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
        connection.subscribe(player);

        if (!voiceSessions.has(guildId)) voiceSessions.set(guildId, {});
        voiceSessions.get(guildId)[botId] = {
            player,
            voiceChannelId: channel.id,
            targetTextChannels: [...new Set(targetTextChannels)] // 重複削除
        };

        await interaction.reply(`<#${channel.id}> に参加したにゃ！読み上げを開始するにゃ。`);
    } else if (subcommand === "leave") {
        const connection = getVoiceConnection(guildId);
        if (connection) connection.destroy();

        if (voiceSessions.has(guildId)) {
            delete voiceSessions.get(guildId)[botId];
            if (Object.keys(voiceSessions.get(guildId)).length === 0) voiceSessions.delete(guildId);
        }
        await interaction.reply("退出したにゃ！");
    }
}