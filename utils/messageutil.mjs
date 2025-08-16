// utils\messageutil.mjs
import { getWebhookInChannel, getWebhook } from "../utils/webhook.mjs";
import { deletebutton } from "../components/buttons.mjs";
import { EmbedBuilder } from "discord.js";

// Embedを作成する関数(引用プレビュー用)
export function createEmbed(
  url,
  title,
  description,
  author,
  imageUrl,
  timestamp,
  color,
  footertxt
) {
  return new EmbedBuilder()
    .setURL(url)
    .setTitle(title)
    .setDescription(description || "(本文がありません)")
    .setAuthor({
      name: author.displayName,
      iconURL: author.displayAvatarURL(),
    })
    .setImage(imageUrl)
    .setTimestamp(timestamp)
    .setColor(color)
    .setFooter({
      text: footertxt,
    });
}

// メッセージから画像URLを取得する関数（引用プレビュー用）
export async function getImagesFromMessage(message) {
  const imageUrlRegex =
    /https:\/\/[^\s]+?\.(png|jpg|jpeg|gif|webp)(?:\?[^\s]*)?/gi;
  // 添付ファイルを並べ、画像ファイルを取得
  const fileUrls = message.attachments.map((attachment) => attachment.url);
  let images = fileUrls.filter((url) =>
    url.match(/\.(png|jpg|jpeg|gif|webp)(?:\?[^\s]*)?$/i)
  );

  // メッセージ内の全ての画像URLを取得
  const imgMatches = message.content.matchAll(imageUrlRegex);
  const imageUrls = [...imgMatches].map((match) => match[0]);

  // `images` 配列の末尾に `imageUrls` 配列を追加する
  images = [...images, ...imageUrls];

  // 画像が5個以上の場合は先頭4つだけを残す（discordの画像サムネは4つまでなので無駄なembedを作らない)
  if (images.length > 5) images = images.slice(0, 4);

  return images;
}

//メッセージ送信系
export async function sendMessage(message, newmessage, fileUrls, embeds, flag) {
  //本人に見せかけてメッセージを送信しなおすスクリプト
  //メッセージ発信者の名前とアバターURL
  const nickname = message.member.displayName;
  const avatarURL = message.author.displayAvatarURL({
    dynamic: true,
  });
  //Webhookの取得（なければ作成する）
  let webhook = null;
  let Threadid = null;
  //スレッドであるかチェックし、スレッドなら親チャンネルのwebhookを用いてスレッドに投稿する形を取る
  if (!message.channel.isThread()) {
    webhook = await getWebhookInChannel(message.channel);
  } else {
    webhook = await getWebhookInChannel(message.channel.parent);
    Threadid = message.channel.id;
  }
  //メッセージ送信（今回は受け取ったものをそのまま送信）
  //usernameとavatarURLをメッセージ発信者のものに指定するのがミソ
  //元メッセージの返信があるかチェック
  let replyToMessage = null;
  if (message.reference) {
    replyToMessage = message.reference.messageId
      ? await message.channel.messages.fetch(message.reference.messageId)
      : null;
  }
  //返信ならwebhookを用いず
  if (replyToMessage) {
    await replyToMessage.reply({
      content: `<@${message.author.id}>:\n${newmessage}`,
      files: fileUrls,
      embeds: embeds,
      flags: [flag],
      threadId: Threadid,
      components: [deletebutton],
    });
  } else {
    //元メッセージが返信でない場合
    try {
      await webhook.send({
        // ★ awaitがないと送信完了を待たず、エラー捕捉やメッセージ削除に影響
        content: `<@${message.author.id}>:\n${newmessage}`,
        files: fileUrls,
        embeds: embeds,
        flags: [flag],
        components: [deletebutton],
        username: nickname,
        threadId: Threadid,
        avatarURL: avatarURL,
      });
    } catch (e) {
      message.channel.send({
        content: `<@${message.author.id}>:\n${newmessage}`,
        files: fileUrls,
        embeds: embeds,
        flags: [flag],
        components: [deletebutton],
      });
      console.error("Error fetching message:", e);
    }
  }
}

/**
 * メッセージを安全に削除します。
 * Deploy直後の多重起動や0.1秒で消せる超能力者が出た時など（笑）に
 * ターゲットが既に存在しない場合は、エラーを無視して正常に終了します。
 * 
 * 対応エラーコード:
 * - 10008: Unknown Message (主に message.delete() で発生)
 * - 10062: Unknown Interaction (主に interaction.reply() の返信をdelete()する時などに発生)
 * @param {import('discord.js').Message | import('discord.js').Interaction} target 削除したいメッセージ、またはインタラクションの返信
 * @returns {Promise<void>}
 */
export async function safeDelete(target) {
  // targetがnull、またはdeleteメソッドを持たない不正なオブジェクトの場合は、何もしない
  if (!target || typeof target.delete !== "function") {
    return;
  }

  try {
    await target.delete();
  } catch (error) {
    // Discord APIが「Unknown Message」または「Unknown Interaction」を返した場合、
    // それは「既に削除済み」ということなので、成功と見なす。
    if (error.code === 10008 || error.code === 10062) {
      console.log("[safeDelete]Unknown MessageかUnknown Interactionが出たようですが無視しました。");
    } else {
      // それ以外の、本当に予期せぬエラー（権限不足など）は、ちゃんとログに残す
      console.error("[safeDelete]予期せぬエラーが発生しました:", error);
    }
  }
}
