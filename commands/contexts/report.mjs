// commands/contexts/report.mjs
import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  LabelBuilder,
  TextDisplayBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from "discord.js";
import config from "../../config.mjs";

export const scope = "guild";
export const help = {
  category: "context",
  description: "メッセージを通報フォームから報告します。",
};

export const data = new ContextMenuCommandBuilder()
  .setName("【このメッセージを報告】")
  .setType(ApplicationCommandType.Message);

export async function execute(interaction) {
  // 1. 通報対象のメッセージを取得
  const targetMessage = interaction.targetMessage;

  // システムメッセージは通報不可
  if (targetMessage.system) {
    return interaction.reply({
      content: "システムメッセージは通報できません。",
      ephemeral: true,
    });
  }

  // 2. Modalを構築
  // awaitModalSubmitを使うので、customIdは固定でOK（識別できれば何でもいい）
  const modalId = `report_modal_${interaction.id}`;
  const modal = new ModalBuilder()
    .setTitle("メッセージの報告")
    .setCustomId(modalId);

  modal.addTextDisplayComponents(
    new TextDisplayBuilder()
      .setContent(
        "⚠️ **必ずお読みください**\n" +
          "このフォームを送信すると、対象のメッセージと入力内容が**管理人室**に送信されます。\n\n" +
          "・個人的な好悪による通報はご遠慮ください。\n" +
          "・ブロック機能で解決可能な場合はそちらをご利用ください。\n" +
          "・緊急性の高い荒らし行為などは即時報告をお願いします。"
      )
  );

  modal.addLabelComponents(
    new LabelBuilder()
      .setLabel("補足情報（任意）")
      .setDescription(
        "報告の理由や、管理人に伝えたいことがあれば入力してください。"
      )
      .setTextInputComponent(
        new TextInputBuilder()
          .setCustomId("report_comment")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("ここに報告の理由を記入（任意）")
          .setMaxLength(1000)
          .setRequired(false)
      )
  );

  // 3. Modalを表示
  await interaction.showModal(modal);

  // 4. 提出を待機 (awaitModalSubmit)
  try {
    const submitted = await interaction.awaitModalSubmit({
      // 自分のIDのModal、かつ自分自身からの提出のみ受け付ける
      filter: (i) =>
        i.customId === modalId && i.user.id === interaction.user.id,
      time: 600_000, // 10分 (600秒) 待機
    });

    // ▼▼▼ ここから提出後の処理 ▼▼▼
    // ※ targetMessage 変数がそのまま使える！

    await submitted.deferReply({ ephemeral: true });

    const comment =
      submitted.fields.getTextInputValue("report_comment") || "なし";
    const adminChannel = interaction.guild.channels.cache.get(
      config.logch.admin
    );

    if (adminChannel) {
      const reportEmbed = new EmbedBuilder()
        .setTitle("🚨 通報ログ")
        .setColor("#FF0000")
        .setAuthor({
          name: `報告者: ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .addFields(
          { name: "報告理由・補足", value: comment },
          {
            name: "対象メッセージ送信者",
            value: `${targetMessage.author.tag} (<@${targetMessage.author.id}>)`,
            inline: true,
          },
          {
            name: "場所",
            value: `${interaction.channel.name} (<#${interaction.channel.id}>)`,
            inline: true,
          },
          {
            name: "対象メッセージ内容",
            value: targetMessage.content || "（画像または埋め込みのみ）",
          }
        )
        .setTimestamp()
        .setFooter({ text: `Message ID: ${targetMessage.id}` });

      const linkButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("対象メッセージへジャンプ")
          .setStyle(ButtonStyle.Link)
          .setURL(targetMessage.url)
      );

      await adminChannel.send({
        content: `<@&${config.moderator}> メッセージの報告がありました。`,
        embeds: [reportEmbed],
        components: [linkButton],
      });

      await submitted.editReply(
        "✅ 報告を受け付けました。ご協力ありがとうございます。"
      );
    } else {
      await submitted.editReply("管理人室チャンネルが見つかりませんでした。");
    }
  } catch (error) {
    // タイムアウトやエラーの場合
    if (error.code === "InteractionCollectorError") {
      // タイムアウト時は何も言わずに終了するか、フォローを入れる
      console.log("Report modal timed out.");
    } else {
      console.error("Report processing error:", error);
      // すでにdeferしているか確認して返信
      // catchに来るタイミングによっては reply できないこともあるので注意
    }
  }
}
