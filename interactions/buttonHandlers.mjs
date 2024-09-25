import {
  deleteconfirm
} from "../components/buttons.mjs"
import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} from "discord.js"

export default async function handleButtonInteraction(interaction) {
  const DMregex = /^admin_replytoDM-(\d+)$/;
  const DMmatch = interaction.customId.match(DMregex);
  //削除ボタン
  if (interaction.customId == "delete" || interaction.customId == "deleteanyone") {
    if (!interaction.message.mensions) {
      await interaction.message.fetch();
    } //なければ取得
    //削除ボタンを押されたとき、消せる人がanyoneでないならその本文の文頭にあるメンションの人を投稿者として認識、削除権限の有無を確かめる。
    const userIdPattern = new RegExp(`^<@${interaction.user.id}>`, 'i'); //自分宛てへのメンションで始まるメッセージなら投稿者
    if (userIdPattern.test(interaction.message.content) || interaction.customId == "deleteanyone") {
      //確認メッセージを送信
      await interaction.reply({
        content: 'このメッセージを削除しますか？',
        components: [deleteconfirm],
        ephemeral: true
      });
      return;
    } else { //削除権限無し
      await interaction.reply({
        content: 'このメッセージを削除できるのは投稿者のみです。',
        ephemeral: true
      });
      return;
    }
  } else if (interaction.customId === 'confirm_delete') {
    // メッセージを削除する処理
    const messageToDelete = await interaction.channel.messages.fetch(interaction.message.reference.messageId); // 削除するメッセージを取得
    if (messageToDelete) {
      await messageToDelete.delete();
      await interaction.update({
        content: 'メッセージが削除されました。',
        components: []
      });
    } else {
      await interaction.update({
        content: 'メッセージが見つかりませんでした。',
        components: []
      });
    }
    return;
  } else if (interaction.customId === 'cancel_delete') {
    await interaction.update({
      content: '削除がキャンセルされました。',
      components: []
    });
    return;
    //admin系、DMからの返信を受け取るmodal
  } else if (interaction.customId === 'admin_replyfromDM') {
    const modal = new ModalBuilder()
      .setTitle("管理人室に返信します")
      .setCustomId("admin_replyfromDM_submit");
    const TextInput = new TextInputBuilder()
      .setLabel("メッセージ")
      .setCustomId("message")
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(2000)
      .setMinLength(2)
      .setRequired(true);
    const ActionRow = new ActionRowBuilder().setComponents(TextInput);
    modal.setComponents(ActionRow);
    return interaction.showModal(modal);
    //admin、dmからきた返信に更に返信するmodal
  } else if (DMmatch) {
    const modal = new ModalBuilder()
      .setTitle("DMに再度管理人室より返信します")
      .setCustomId(`admin_replytoDM_submit-${DMmatch[1]}`);
    const TextInput = new TextInputBuilder()
      .setLabel("メッセージ")
      .setCustomId("message")
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(2000)
      .setMinLength(2)
      .setRequired(true);
    const replyInput = new TextInputBuilder()
      .setLabel("返信を許可するか(0で禁止)")
      .setCustomId("replyable")
      .setMaxLength(1)
      .setValue('1')
      .setRequired(true)
      .setStyle(TextInputStyle.Short);
    const ActionRow = new ActionRowBuilder().setComponents(TextInput);
    const ActionRowSecond = new ActionRowBuilder().setComponents(replyInput);
    modal.setComponents(ActionRow, ActionRowSecond);
    return interaction.showModal(modal);
  } else { //ボタンが不明のとき
    return;
  }

};