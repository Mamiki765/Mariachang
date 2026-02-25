//commands\utils\vc.mjs
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import {
    joinVoiceChannel,
    getVoiceConnection,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    StreamType,
    NoSubscriberBehavior
} from "@discordjs/voice";

// =========================================================================
// ▼ 状態管理（重要）▼
// 各サーバー（Guild）ごとの「音声再生プレイヤー」を管理するMap
// これにより、AサーバーとBサーバーで同時に別々の音声を流せるようになります。
// =========================================================================
export const voicePlayers = new Map();

// ヘルプコマンド用の情報エクスポート
export const help = {
    category: "slash",
    subcommands: [
        {
            name: "join",
            description: "あなたが今いるボイスチャンネルにマリアを呼び出します。",
            notes: "読み上げ機能を使う前に実行してにゃ。",
        },
        {
            name: "leave",
            description: "マリアをボイスチャンネルから退出させます。",
            notes: "用が済んだら帰らせてにゃ。",
        },
        {
            name: "debug",
            description: "指定したテキストをずんだもんの声で読み上げます（テスト用）。",
            notes: "マリアがVCにいる状態でないとエラーになります。",
        },
    ],
};

// スラッシュコマンドの定義
export const data = new SlashCommandBuilder()
    .setName("vc")
    .setNameLocalizations({ ja: "ボイスチャンネル" })
    .setDescription("ボイスチャンネル関連の操作を行います。")
    // サブコマンド: join
    .addSubcommand((subcommand) =>
        subcommand
            .setName("join")
            .setNameLocalizations({ ja: "参加" })
            .setDescription("あなたが参加しているボイスチャンネルにBotを呼び出します。")
    )
    // サブコマンド: leave
    .addSubcommand((subcommand) =>
        subcommand
            .setName("leave")
            .setNameLocalizations({ ja: "退出" })
            .setDescription("Botをボイスチャンネルから退出させます。")
    )
    // サブコマンド: debug
    .addSubcommand((subcommand) =>
        subcommand
            .setName("debug")
            .setNameLocalizations({ ja: "テスト発声" })
            .setDescription("入力したテキストをずんだもんの声で読み上げます。")
            .addStringOption((option) =>
                option
                    .setName("text")
                    .setDescription("読み上げさせたいテキストを入力してね")
                    .setRequired(true)
            )
    );

// コマンド実行時の処理
export async function execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === "join") {
        await handleJoin(interaction, guildId);
    } else if (subcommand === "leave") {
        await handleLeave(interaction, guildId);
    } else if (subcommand === "debug") {
        await handleDebug(interaction, guildId);
    }
}

// ---------------------------------------------------------
// ▼ 各サブコマンドの処理関数 ▼
// ---------------------------------------------------------

async function handleJoin(interaction, guildId) {
    // ユーザーがVCにいるか確認
    const memberVoiceChannel = interaction.member.voice.channel;
    if (!memberVoiceChannel) {
        return interaction.reply({
            content: "先にボイスチャンネルに入ってから呼んでほしいにゃ！",
            flags: 64, // ephemeral
        });
    }

    // すでにVCに接続済みか確認
    const existingConnection = getVoiceConnection(guildId);
    if (existingConnection) {
        return interaction.reply({
            content: "もうどこかのボイスチャンネルにお邪魔してるにゃ！",
            flags: 64,
        });
    }

    try {
        // VCに接続
        const connection = joinVoiceChannel({
            channelId: memberVoiceChannel.id,
            guildId: guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator,
        });

        // このサーバー専用の「再生プレイヤー」を作成
        const player = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Pause,
            },
        });

        // 接続とプレイヤーを紐付ける
        connection.subscribe(player);

        // Mapにこのサーバーのプレイヤーを保存しておく
        voicePlayers.set(guildId, player);

        await interaction.reply(`🔊 <#${memberVoiceChannel.id}> に参加したにゃ！`);
    } catch (error) {
        console.error("[VC Join Error]", error);
        await interaction.reply({
            content: "ボイスチャンネルへの接続中にエラーが発生したにゃ……",
            flags: 64,
        });
    }
}

async function handleLeave(interaction, guildId) {
    const connection = getVoiceConnection(guildId);
    if (!connection) {
        return interaction.reply({
            content: "そもそもボイスチャンネルに入ってないにゃ！",
            flags: 64,
        });
    }

    // 切断処理と、Mapからのプレイヤー削除
    connection.destroy();
    voicePlayers.delete(guildId);

    await interaction.reply("👋 ボイスチャンネルから退出したにゃ！");
}

async function handleDebug(interaction, guildId) {
    // 1. 本番環境以外（ローカル・デバッグ）では動作させないガード処理
    if (process.env.NODE_ENV?.trim() !== "production") {
        return interaction.reply({
            content: "今の私は開発モード（おやすみ中）だから、おしゃべりできないにゃ！本番環境で試してにゃ。",
            flags: 64, // ephemeral
        });
    }

    // BotがVCにいるか確認
    const player = voicePlayers.get(guildId);
    if (!player) {
        return interaction.reply({
            content: "まずは `/vc join` で私をボイスチャンネルに呼んでにゃ！",
            flags: 64,
        });
    }

    const text = interaction.options.getString("text");
    await interaction.deferReply(); 

    try {
        // 2. .envからURLを読み込む（設定されていなければローカルホストをフォールバックに）
        const baseUrl = process.env.VOICEVOX_URL || "http://127.0.0.1:50021";
        const speakerId = 3; 

        // URLを環境変数ベースに変更
        const queryRes = await fetch(`${baseUrl}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`, {
            method: 'POST',
        });
        
        if (!queryRes.ok) throw new Error("audio_query failed");
        const queryJson = await queryRes.json();

        const synthRes = await fetch(`${baseUrl}/synthesis?speaker=${speakerId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(queryJson),
        });

        if (!synthRes.ok) throw new Error("synthesis failed");
        
        const arrayBuffer = await synthRes.arrayBuffer();
        const audioBuffer = Buffer.from(arrayBuffer);

        const resource = createAudioResource(audioBuffer, {
            inputType: StreamType.Arbitrary,
        });
        
        player.play(resource);
        await interaction.editReply(`🎤 テスト再生: 「${text}」`);

    } catch (error) {
        console.error("[VOICEVOX Error]", error);
        await interaction.editReply("音声の生成、または再生中にエラーが起きたにゃ……");
    }
}