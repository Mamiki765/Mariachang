import {ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
//削除ボタン（最初にメンションされている人だけが消せる）
// content: `<@${interaction.user.id}>`などでIDをメッセージの先頭に付けておくこと
export  const deletebutton = new ActionRowBuilder()
         .addComponents(
            new ButtonBuilder()
             .setEmoji('🗑️')
             .setLabel("削除")
             .setStyle(ButtonStyle.Danger)
             .setCustomId("delete")
                    )
//削除ボタン（誰でも消せる、DMとかpingなど一人しかそもそも押せない、誰でも押せる奴につかう）
export  const deletebuttonanyone = new ActionRowBuilder()
         .addComponents(
            new ButtonBuilder()
             .setEmoji('🗑️')
             .setLabel("削除")
             .setStyle(ButtonStyle.Danger)
             .setCustomId("deleteanyone")
                    )

//削除時の確認ボタン2種類
const confirmationButton = new ButtonBuilder()
            .setEmoji('✅')
            .setCustomId('confirm_delete')
            .setLabel('削除する')
            .setStyle(ButtonStyle.Danger);
const cancelButton = new ButtonBuilder()
            .setEmoji('❌')
            .setCustomId('cancel_delete')
            .setLabel('キャンセル')
            .setStyle(ButtonStyle.Secondary);
export  const deleteconfirm = new ActionRowBuilder().addComponents(confirmationButton, cancelButton);

//(admin用)
//DMにつけられた返信ボタン
export const replyfromDM = new ActionRowBuilder()
         .addComponents(
      new ButtonBuilder()
            .setEmoji('✉️')
            .setCustomId('admin_replyfromDM')
            .setLabel('返信(1度だけできます)')
            .setStyle(ButtonStyle.Secondary)
           );
//DMからの返信に更に返信するボタン
// 引数で受け取った番号を使って CustomId を設定する
export function replytoDM(id) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setEmoji('✉️')
        .setCustomId(`admin_replytoDM-${id}`)
        .setLabel('返信')
        .setStyle(ButtonStyle.Secondary)
    );
}