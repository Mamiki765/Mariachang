//handlers/messageCreate.mjs
import config from "../config.mjs";
//ドミノ並べ
import { dominoeffect } from "../commands/utils/domino.mjs";
//　メッセージ周り
import {
  createEmbed,
  getImagesFromMessage,
  sendMessage,
  safeDelete,
} from "../utils/messageutil.mjs";
import { deletebuttonunique } from "../components/buttons.mjs";
// 250904発言によるピザ(チップ)トークン獲得
const activeUsersForPizza = new Map(); // Key: userId, Value: memberオブジェクト
export { activeUsersForPizza };
import {
  updateAchievementProgress,
} from "../utils/achievements.mjs";
//counting
import { sequelize, CountingGame, Point } from "../models/database.mjs";
//読み上げ
import { voiceSessions, enqueueAudio } from "../commands/utils/vc.mjs"; // Mapをインポート
import { handleReactionAndShortcutBlock } from "./messageCreate/reactionAndShortcutBlock.mjs";

//ロスアカのアトリエURL検知用
//250706 スケッチブックにも対応
const rev2AtelierurlPattern =
  /https:\/\/rev2\.reversion\.jp\/(?:illust\/detail\/ils(\d+)|illust\/sketchbook\/illust\/(\d+))/g;
//実際のメッセージ処理
export default async (message) => {
  // --- A. 読み上げ処理 ---
  const guildId = message.guildId;
  const botId = message.client.user.id;
  const sessions = voiceSessions.get(guildId);

  if (sessions && sessions[botId]) {
    const session = sessions[botId];
    // 発言チャンネルが読み上げ対象か確認
    if (session.targetTextChannels.includes(message.channelId)) {
      // 👨‍🏫 窓口（enqueueAudio）にテキストを投げるだけ！面倒な処理はvc.mjsがやってくれる！
      await enqueueAudio(guildId, botId, message.content);
    }
  }
  // --- B. 既存のBot除外ガード (ここから下は人間の操作のみ) ---
  // 他のBotの発言は読み上げるが、以下のダイスやピザ等の機能は実行させない
  if (message.author.bot) return;

  // DMなどの場合は member が取れないので null になることを許容
  activeUsersForPizza.set(message.author.id, message.member || null);
  // ここから反応
  //メンション
  if (
    message.mentions.has(config.botid) &&
    !message.mentions.everyone &&
    !(message.channel.nsfw || message.channel.parent?.nsfw)
  ) {
    //250718 NSFWチャンネルでは反応しないように
    const url = message.guild
      ? `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`
      : "（DM）";
    await message.client.channels.cache.get(config.logch.reply_log)?.send({
      flags: [4096],
      content: `<@${message.author.id}>:${message.content} > ${url}`,
    });
  }
  //カウンティング
  if (message.channel.id === config.countingGame.channelId) {
    // awaitを付けて、処理が終わるのを待つ
    await handleCountingGame(message);
    // カウンティングチャンネルでは他の処理を行わない場合は return する
    return;
  }
  // リアクション～ショートカット応答は handlers/messageCreate/reactionAndShortcutBlock.mjs に分離
  await handleReactionAndShortcutBlock(message);

  //ロスアカアトリエURL＋250706スケッチブックURLが貼られた時、画像を取得する機能
  await handleAtelierUrlPreview(message);

  //ドミノを並べる処理
  if (
    message.content.match(/(どみの|ドミノ|ﾄﾞﾐﾉ|domino|ドミドミ|どみどみ)/i) ||
    message.channel.id === config.dominoch ||
    message.channel.id === "1364908910032719934" //別館ドミノ
  ) {
    let dpname = null;
    if (!message.member) {
      dpname = message.author.displayName;
    } else {
      dpname = message.member.displayName;
    }
    await dominoeffect(
      message,
      message.client,
      message.author.id,
      message.author.username,
      dpname
    );
  }
  /*
  ここから大きな処理２つめ
  X、メッセージリンクを検知して処理する。
  両方あったらXを優先する。
  まずはX、ついでにNsfwならpixivも
  */
  await handleMessageLinkFeatures(message);
};

/*
メッセージ処理ここまで、以下サブルーチン
*/

async function handleAtelierUrlPreview(message) {
  if (!message.content.match(rev2AtelierurlPattern)) return;

  const matches = [...message.content.matchAll(rev2AtelierurlPattern)];
  if (matches.length === 0) return;

  try {
    const component = deletebuttonunique(message.author.id);
    const fetchedMessage = await message.channel.messages.fetch(message.id);
    const thumbnails = [];

    const fetchThumbnailForMatch = async (match) => {
      const embed = fetchedMessage.embeds.find((embed) => embed.url === match[0]);
      if (embed && embed.thumbnail && embed.thumbnail.url) {
        if (embed.thumbnail.url !== "https://rev2.reversion.jp/og.webp") {
          const originalImageUrl = extractOriginalImageUrl(embed.thumbnail.url);
          if (!thumbnails.includes(originalImageUrl)) {
            thumbnails.push(originalImageUrl);
          }
        }
        return;
      }

      console.log(`URL ${match[0]} に一致するEmbedが見つかりませんでした`);

      await new Promise((resolve) => {
        setTimeout(async () => {
          try {
            const retryFetchedMessage = await message.channel.messages.fetch(message.id);
            const retryEmbed = retryFetchedMessage.embeds.find(
              (embed) => embed.url === match[0]
            );

            if (retryEmbed && retryEmbed.thumbnail && retryEmbed.thumbnail.url) {
              if (retryEmbed.thumbnail.url !== "https://rev2.reversion.jp/og.webp") {
                const originalImageUrl = extractOriginalImageUrl(retryEmbed.thumbnail.url);
                if (!thumbnails.includes(originalImageUrl)) {
                  thumbnails.push(originalImageUrl);
                }
              } else {
                console.log(
                  `リトライでもデフォルトのサムネイルURL ${retryEmbed.thumbnail.url} は除外されました。`
                );
              }
            } else {
              console.log(
                `リトライでもURL ${match[0]} に一致するEmbedが見つかりませんでした`
              );
            }
            resolve();
          } catch (retryError) {
            console.error("リトライ時のメッセージの再取得に失敗しました:", retryError);
            resolve();
          }
        }, 10000);
      });
    };

    await Promise.all(matches.map(fetchThumbnailForMatch));

    if (thumbnails.length > 0) {
      await message.channel.send({
        flags: [4096],
        content: thumbnails.join("\n"),
        components: [component],
      });
    }
  } catch (error) {
    console.error("メッセージの再取得に失敗しました:", error);
  }
}

async function handleMessageLinkFeatures(message) {
  if (
    message.content.match(
      /https?:\/\/(twitter\.com|x\.com)\/[^/]+\/status\/\d+\/?(\?.*)?|https?:\/\/www\.pixiv\.net\/artworks\/\d+/
    )
  ) {
    if (!message.guild) return;

    let updatedMessage = message.content
      .replace(/https:\/\/twitter\.com/g, "https://fxtwitter.com")
      .replace(/https:\/\/x\.com/g, "https://fixvx.com");
    if (message.channel.nsfw || message.channel.parent?.nsfw) {
      updatedMessage = updatedMessage.replace(
        /https?:\/\/www\.pixiv\.net\/artworks\//g,
        "https://www.phixiv.net/artworks/"
      );
    }
    const fileUrls = message.attachments.map((attachment) => attachment.url);
    await sendMessage(message, updatedMessage, fileUrls, null, 4096);
    await safeDelete(message);
    return;
  }

  if (!message.content.match(/https?:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/)) {
    return;
  }
  if (!message.guild) return;

  const MESSAGE_URL_REGEX = /https?:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;
  const matches = MESSAGE_URL_REGEX.exec(message.content);
  if (!matches) return;

  const [fullMatch, guildId, channelId, messageId] = matches;
  if (guildId !== message.guild.id) return;

  try {
    const channel = await message.guild.channels.fetch(channelId);
    const fetchedMessage = await channel.messages.fetch(messageId);
    if (!fetchedMessage) return;

    if (channel.isThread() && channel.type === 12 && message.channel.id !== channel.id) return;
    if (
      (channel.parent?.nsfw || channel.nsfw) &&
      !(message.channel.parent?.nsfw || message.channel.nsfw)
    )
      return;
    if (
      config.privatecategory.includes(channel.parentId) &&
      message.channel.id !== channel.id
    )
      return;

    const images = await getImagesFromMessage(fetchedMessage);
    const files = fetchedMessage.attachments.map((attachment) => attachment.url).join("\n");
    let sendmessage = files ? fetchedMessage.content + `\n` + files : fetchedMessage.content;

    if (fetchedMessage.stickers && fetchedMessage.stickers.size > 0) {
      const firstSticker = fetchedMessage.stickers.first();
      sendmessage += "スタンプ：" + firstSticker.name;
      images.unshift(firstSticker.url);
    }
    const embeds = [];
    const channelname = `#${channel.name}`;
    const embed = createEmbed(
      fullMatch,
      "引用元へ",
      sendmessage,
      fetchedMessage.author,
      images[0],
      fetchedMessage.createdAt,
      "#0099ff",
      channelname
    );
    embeds.push(embed);

    if (images.length > 1) {
      for (let i = 1; i < images.length; i++) {
        const imageEmbed = createEmbed(
          fullMatch,
          null,
          null,
          {
            displayName: null,
            displayAvatarURL: () => null,
          },
          images[i],
          fetchedMessage.createdAt,
          "#0099ff",
          null
        );
        embeds.push(imageEmbed);
      }
    }

    if (
      fetchedMessage.embeds[0] &&
      fetchedMessage.embeds[0].data.type !== "image" &&
      fetchedMessage.embeds[0].data.type !== "gifv"
    ) {
      embeds.push(fetchedMessage.embeds[0]);
      console.log(fetchedMessage.embeds[0]);
    }

    if (fetchedMessage.reference) {
      const refMessage = await channel.messages.fetch(fetchedMessage.reference.messageId);
      if (refMessage) {
        const refMatch = `https://discord.com/channels/${guildId}/${channelId}/${fetchedMessage.reference.messageId}`;
        const refImages = await getImagesFromMessage(refMessage);
        let refSendMessage = refMessage.attachments.map((attachment) => attachment.url).join("\n")
          ? refMessage.content +
            `\n` +
            refMessage.attachments.map((attachment) => attachment.url).join("\n")
          : refMessage.content;
        if (refMessage.stickers && refMessage.stickers.size > 0) {
          const refFirstSticker = refMessage.stickers.first();
          refSendMessage += "スタンプ：" + refFirstSticker.name;
          refImages.unshift(refFirstSticker.url);
        }
        const refEmbed = createEmbed(
          refMatch,
          "引用元の返信先",
          refSendMessage,
          refMessage.author,
          refImages[0],
          refMessage.createdAt,
          "#B78CFE",
          null
        );
        embeds.push(refEmbed);

        if (refImages.length > 1) {
          for (let i = 1; i < refImages.length; i++) {
            const refImageEmbed = createEmbed(
              refMatch,
              null,
              null,
              {
                displayName: null,
                displayAvatarURL: () => null,
              },
              refImages[i],
              refMessage.createdAt,
              "#B78CFE",
              null
            );
            embeds.push(refImageEmbed);
          }
        }
        if (
          refMessage.embeds[0] &&
          refMessage.embeds[0].data.type !== "image" &&
          refMessage.embeds[0].data.type !== "gifv"
        ) {
          embeds.push(refMessage.embeds[0]);
        }
      }
    }

    const fileUrls = message.attachments.map((attachment) => attachment.url);
    let newmessage = message.content;
    const regex = new RegExp(fullMatch, "i");
    newmessage = newmessage.replace(regex, `**（変換済み)**`);
    if (newmessage == `**（変換済み)**`) newmessage = "";
    await sendMessage(message, newmessage, fileUrls, embeds, 4096);
    await safeDelete(message);
  } catch (error) {
    console.error("Error fetching message:", error);
    message.reply({
      content: "メッセージを取得できませんでした。",
      flags: 64,
    });
  }
}

/**
 * カウンティングゲームのメッセージを処理するハンドラ
 * @param {import('discord.js').Message} message
 */
async function handleCountingGame(message) {
  // メッセージが数字のみで構成されているか正規表現でチェック
  // これで "123a" や "1.5" のような入力を弾きます
  if (!/^\d+$/.test(message.content)) {
    try {
      await message.delete();
    } catch (error) {
      // メッセージが既に削除されている場合などのエラーは無視
      console.error("[カウンティング]不正なメッセージの削除に失敗", error);
    }
    return;
  }

  const userNumber = parseInt(message.content, 10);

  try {
    await sequelize.transaction(async (t) => {
      const [game, created] = await CountingGame.findOrCreate({
        where: { channelId: message.channel.id },
        defaults: { currentNumber: 0 },
        transaction: t,
        lock: t.LOCK.UPDATE, // ★レースコンディション防止の要
      });

      const expectedNumber = game.currentNumber + 1;

      // 連続投稿チェック (configに allowConsecutivePosts: false があれば)
      if (
        config.countingGame.allowConsecutivePosts === false &&
        game.lastUserId === message.author.id
      ) {
        await message.delete();
        return;
      }

      // 番号が間違っている場合も削除
      if (userNumber !== expectedNumber) {
        // 多重起動時、遅延したインスタンスが正常な投稿を誤って削除するのを防ぐ
        // DBの最新情報が「まさにこのメッセージで成功した直後」であるかを確認
        if (
          game.lastMessageId === message.id &&
          game.currentNumber === userNumber
        ) {
          // 他のインスタンスが正常処理した結果なので、削除せず、静かに終了
          return;
        }
        // ダブルチェックに該当しない、本当に間違った投稿は削除
        await message.delete();
        return;
      }

      // --- 正解！ ---

      // 1. DBのゲーム状態を更新
      await game.update(
        {
          currentNumber: expectedNumber,
          lastUserId: message.author.id,
          lastMessageId: message.id,
        },
        { transaction: t }
      );

      // 2. 報酬を計算
      const rewards = config.countingGame.rewards;
      const coinReward = rewards.coin || 0;
      const nyoboBankReward =
        Math.floor(
          Math.random() * (rewards.nyobo_bank.max - rewards.nyobo_bank.min + 1)
        ) + rewards.nyobo_bank.min;

      // 3. 報酬をPointテーブルに加算
      // findOrCreateでユーザーデータがない場合も対応
      const [point, pointCreated] = await Point.findOrCreate({
        where: { userId: message.author.id },
        defaults: { userId: message.author.id },
        transaction: t,
      });

      await point.increment(
        {
          coin: coinReward,
          nyobo_bank: nyoboBankReward,
        },
        { transaction: t }
      );

      // 4. 静かにリアクション
      if (config.countingGame.successReaction) {
        await message.react(config.countingGame.successReaction);
      }

      // 5. 実績を解除
      // 毎回の成功時に進捗を+1する。目標達成は関数内で自動的に処理される。
      await updateAchievementProgress(message.client, message.author.id, 60);
    });
  } catch (error) {
    console.error("[Counting] トランザクションでエラーが発生しました:", error);
    try {
      // 失敗した場合は分かりやすくエラーのリアクションを付ける
      await message.react("❌");
    } catch (reactError) {
      // リアクション追加すら失敗した場合
      console.error("[Counting]エラーリアクションの追加に失敗:", reactError);
    }
  }
}

// --- ヘルパー関数を定義 (ifブロックの外や、ファイルの上のほうに置いておくと綺麗です) ---
/**
 * DiscordのサムネイルURL(_next/image)から元の画像URLを抽出する
 * @param {string} thumbnailUrl - DiscordのEmbedに表示されるサムネイルURL
 * @returns {string} 抽出された元の画像URL、または変換不要/失敗した場合は元のURL
 */
function extractOriginalImageUrl(thumbnailUrl) {
  // URLが存在し、かつ_next/imageを含む場合のみ処理
  if (thumbnailUrl && thumbnailUrl.includes("/_next/image?")) {
    try {
      const urlObj = new URL(thumbnailUrl);
      const originalUrl = urlObj.searchParams.get("url"); // 'url'パラメータの値を取得
      if (originalUrl) {
        // URIエンコードされているので、デコードして返す
        return decodeURIComponent(originalUrl);
      }
    } catch (error) {
      console.error("サムネイルURLの解析に失敗しました:", error);
      return thumbnailUrl; // エラー時は元のURLをそのまま返す
    }
  }
  // _next/imageを含まないURLは、そのまま返す
  return thumbnailUrl;
}
