import {
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
} from "discord.js";
import config from "../config.mjs";

async function waitForMessages(thread, delay = 30000) {
  // 30秒待機
  await new Promise((resolve) => setTimeout(resolve, delay));
  return thread.messages.fetch();
}

export default async (thread) => {
  const forumChannelId = thread.parentId;
  const notifyChannelId = config.forumNotification[forumChannelId];

  if (notifyChannelId) {
    const author = thread.ownerId
      ? await thread.guild.members.fetch(thread.ownerId)
      : null;
    const authorName = author ? author.user.displayName : "不明";
    const authorAvatar = author ? author.user.displayAvatarURL() : null;
    const notifyChannel = await thread.client.channels.fetch(notifyChannelId);

    if (notifyChannel) {
      const parentChannel = await thread.guild.channels.fetch(forumChannelId);
      if (!parentChannel) {
        console.error("親チャンネルが見つかりませんでした。");
        return;
      }

      try {
        // 一旦30秒待機してからメッセージを取得
        const messages = await waitForMessages(thread);
        const message = messages.last();
        // メッセージが存在しない場合
        if (!message) {
          console.warn("スレッド内にメッセージが見つかりませんでした。");
          return;
        }

        // 初期化の修正
        let content = message.content || "本文無し";

        // スタンプ（Sticker）が含まれる場合の対応
        if (message && message.stickers.size > 0) {
          const sticker = message.stickers.first();
          content = sticker ? `スタンプ: ${sticker.name}` : content;
        }

        if (content.match(/非通知/)) {
          return;
        }

        const attachments =
          message && message.attachments
            ? message.attachments.map((att) => att.url)
            : [];
        const firstImage = attachments.length > 0 ? attachments[0] : null;

        const embed = new EmbedBuilder()
          .setTitle(thread.name)
          .setDescription(content)
          .setImage(firstImage)
          .setTimestamp()
          .setFooter({ text: authorName, iconURL: authorAvatar })
          .setColor("#B78CFE");

        const button = new ButtonBuilder()
          .setLabel("スレッドを開く")
          .setStyle(ButtonStyle.Link)
          .setURL(thread.url); // スレッドのURLを使用

        const row = new ActionRowBuilder().addComponents(button);

        notifyChannel.send({
          content: `<#${parentChannel.id}>に新しいスレッドが立ちました！`,
          embeds: [embed],
          components: [row],
        });
      } catch (error) {
        console.error("メッセージ取得中にエラーが発生しました:", error);
      }
    }
  }
};
