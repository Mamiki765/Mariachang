import {ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
//削除ボタン（最初にメンションした人だけが消せる）
// content: `<@${interaction.user.id}>`などIDをメッセージの先頭に付けておくこと
export  const deletebutton = new ActionRowBuilder()
         .addComponents(
            new ButtonBuilder()
             .setEmoji('🗑️')
             .setLabel("削除")
             .setStyle(ButtonStyle.Danger)
             .setCustomId("delete")
                    )
//削除ボタン（誰でも消せる、DMとかにつかう）
export  const deletebuttonanyone = new ActionRowBuilder()
         .addComponents(
            new ButtonBuilder()
             .setEmoji('🗑️')
             .setLabel("削除")
             .setStyle(ButtonStyle.Danger)
             .setCustomId("deleteanyone")
                    )

//削除時の確認ボタン
export  const deleteconfirm = new ActionRowBuilder().addComponents(confirmationButton, cancelButton);
export  const confirmationButton = new ButtonBuilder()
            .setCustomId('confirm_delete')
            .setLabel('削除する')
            .setStyle(ButtonStyle.Danger);
export  const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_delete')
            .setLabel('キャンセル')
            .setStyle(ButtonStyle.Secondary);