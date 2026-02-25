//commands\utils\vc.mjs
import { SlashCommandBuilder } from "discord.js";
import {
    joinVoiceChannel,
    getVoiceConnection,
    createAudioPlayer,
    NoSubscriberBehavior,
    AudioPlayerStatus,
    createAudioResource
} from "@discordjs/voice";
import { Notification } from "../../models/database.mjs";
import axios from "axios";
import { Readable } from "stream"; // Node.js標準モジュール

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
            targetTextChannels: [...new Set(targetTextChannels)],
            queue: [],         // 👩‍🏫 追加: 読み上げる文章の順番待ちリスト
            isPlaying: false   // 👩‍🏫 追加: 現在再生中かどうかのフラグ
        };

        // 👩‍🏫 追加: プレイヤーの音声再生が終わった時のイベント
        player.on(AudioPlayerStatus.Idle, () => {
            playNext(guildId, botId);
        });
        player.on('error', (error) => {
            console.error('[VoiceVox Player Error]', error.message);
            playNext(guildId, botId); // エラーでも止まらずに次へ！
        });

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

/**
 * 👨‍🏫 外部（messageCreate等）から呼び出せる「読み上げ受付窓口」
 */
export async function enqueueAudio(guildId, botId, text) {
    const session = voiceSessions.get(guildId)?.[botId];
    if (!session) return;

    // 1. 辞書変換（将来ここに追加！）
    // text = text.replace(/草/g, "わら");

    // 2. サニタイズ（お掃除）
    let cleanText = text
        .replace(/https?:\/\/\S+/g, "URL省略")
        .replace(/<@[!&]?\d+>/g, "")
        .replace(/<a?:[\w]+:\d+>/g, ""); // カスタム絵文字を読まないように消す
        // （※特定のカスタム絵文字を読ませたい場合は、消す処理の「前」に辞書変換を入れます）

    cleanText = cleanText.trim();
    if (cleanText.length === 0) return;

    // 3. 長文カット
    if (cleanText.length > 60) {
        cleanText = cleanText.substring(0, 60) + "、以下略";
    }

    // 4. キューに追加
    session.queue.push(cleanText);

    // 5. 現在何も再生していなければ、再生スタート！
    if (!session.isPlaying) {
        playNext(guildId, botId);
    }
}

/**
 * 👨‍🏫 内部で使う「順番待ちから取り出して再生する」関数
 */
async function playNext(guildId, botId) {
    const session = voiceSessions.get(guildId)?.[botId];
    if (!session) return;

    if (session.queue.length === 0) {
        session.isPlaying = false;
        return;
    }

    session.isPlaying = true;
    const text = session.queue.shift(); // 先頭の文章を取り出す

    try {
        const baseUrl = process.env.VOICEVOX_URL || "http://127.0.0.1:50021";
        const speakerId = 3; // ずんだもん

        const queryRes = await fetch(`${baseUrl}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`, { method: 'POST' });
        if (!queryRes.ok) throw new Error(`Query API Error: ${queryRes.status}`);
        const queryJson = await queryRes.json();

        const synthRes = await fetch(`${baseUrl}/synthesis?speaker=${speakerId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(queryJson),
        });
        if (!synthRes.ok) throw new Error(`Synthesis API Error: ${synthRes.status}`);

        const arrayBuffer = await synthRes.arrayBuffer();
        const resource = createAudioResource(Readable.from(Buffer.from(arrayBuffer)));
        
        session.player.play(resource);

    } catch (err) {
        console.error("[Reading Error]", err.message);
        // エラーが起きたら、止まらずに次の文章を読みに行く
        playNext(guildId, botId);
    }
}