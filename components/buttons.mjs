import {ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
//削除ボタン（なにかとつかう）
export  const deletebutton = new ActionRowBuilder()
         .addComponents(
            new ButtonBuilder()
             .setEmoji('🗑️')
             .setLabel("削除")
             .setStyle(ButtonStyle.Danger)
             .setCustomId("delete")
                    )