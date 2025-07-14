import {
  getWebhookInChannel,
  getWebhook
} from "../utils/webhook.mjs"
import {
  deletebutton
} from "../components/buttons.mjs"
import {
  EmbedBuilder
} from "discord.js";

// Embedを作成する関数(引用プレビュー用)
export function createEmbed(url, title, description, author, imageUrl, timestamp, color, footertxt) {
  return new EmbedBuilder()
    .setURL(url)
    .setTitle(title)
    .setDescription(description || '(本文がありません)')
    .setAuthor({
      name: author.displayName,
      iconURL: author.displayAvatarURL(),
    })
    .setImage(imageUrl)
    .setTimestamp(timestamp)
    .setColor(color)
    .setFooter({
      text: footertxt
    })

  ;
}

// メッセージから画像URLを取得する関数（引用プレビュー用）
export async function getImagesFromMessage(message) {
  const imageUrlRegex = /https:\/\/[^\s]+?\.(png|jpg|jpeg|gif|webp)(?:\?[^\s]*)?/gi;
  // 添付ファイルを並べ、画像ファイルを取得
  const fileUrls = message.attachments.map(attachment => attachment.url);
  let images = fileUrls.filter(url => url.match(/\.(png|jpg|jpeg|gif|webp)(?:\?[^\s]*)?$/i));

  // メッセージ内の全ての画像URLを取得
  const imgMatches = message.content.matchAll(imageUrlRegex);
  const imageUrls = [...imgMatches].map(match => match[0]);

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
    dynamic: true
  });
  //Webhookの取得（なければ作成する）
  let webhook = null;
  let Threadid = null;
  //スレッドであるかチェックし、スレッドなら親チャンネルのwebhookを用いてスレッドに投稿する形を取る
  if (!message.channel.isThread()) {
    webhook = await getWebhookInChannel(message.channel);
  } else {
    webhook = await getWebhookInChannel(message.channel.parent);
    Threadid = message.channel.id
  }
  //メッセージ送信（今回は受け取ったものをそのまま送信）
  //usernameとavatarURLをメッセージ発信者のものに指定するのがミソ
  //元メッセージの返信があるかチェック
  let replyToMessage = null;
  if (message.reference) {
    replyToMessage = message.reference.messageId ? await message.channel.messages.fetch(message.reference.messageId) : null;
  }
  //返信ならwebhookを用いず
  if (replyToMessage) {
    await replyToMessage.reply({
      content: `<@${message.author.id}>:\n${newmessage}`,
      files: fileUrls,
      embeds: embeds,
      flags: [flag],
      threadId: Threadid,
      components: [deletebutton]
    });
  } else {
    //元メッセージが返信でない場合
    try {
      await webhook.send({// ★ awaitがないと送信完了を待たず、エラー捕捉やメッセージ削除に影響
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
        components: [deletebutton]
      });
      console.error('Error fetching message:', e);
    }
  }
}