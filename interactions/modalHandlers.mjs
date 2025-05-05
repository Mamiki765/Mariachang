import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";
import config from "../config.mjs";
import {
  replytoDM,
  replyfromDM
} from "../components/buttons.mjs";

export default async function handleModalInteraction(interaction) {
  //モーダル
  const DMregex = /^admin_replytoDM_submit-(\d+)$/;
  const DMmatch = interaction.customId.match(DMregex);
  //管理人室とやりとり（ユーザー→モデレーター)
  if (interaction.customId == "admin_replyfromDM_submit") {
    const content = interaction.fields.getTextInputValue('message');
    try {
      //管理人からのメッセージを取得
      if (!interaction.message.embeds[0]) {
        await interaction.message.fetch();
      }
      const component = replytoDM(interaction.user.id);
      //管理人室に返信
      await interaction.client.channels.cache.get(config.logch.admin).send({
        embeds: [
          new EmbedBuilder()
          .setTitle("DMの返信がありました")
          .setColor("#FFD700")
          .setDescription(`送信内容\`\`\`\n${content}\n\`\`\``)
          .setThumbnail(interaction.user.displayAvatarURL({
            dynamic: true
          }))
          .setTimestamp()
          .addFields({
            name: "送信者",
            value: `${interaction.user.displayName}(ID:${interaction.user.id})`
          }, {
            name: "返信されたメッセージ",
            value: interaction.message.embeds[0].description
          })
        ],
        components: [component]

      });
      // ボタンを消す
      const disabledButton = new ButtonBuilder()
        .setCustomId('siyoudumi')
        .setLabel('送信しました')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);
      const newRow = new ActionRowBuilder().addComponents(disabledButton);
      await interaction.message.edit({
        components: [newRow]
      });
      //送信内容をここに表示
      await interaction.user.send({
        embeds: [
          new EmbedBuilder()
          .setTitle("管理人室への返信")
          .setColor("#B78CFE")
          .setDescription(`\`\`\`\n${content}\n\`\`\``)
          .setTimestamp()
        ]
      });
      //完了報告
      await interaction.reply({
        ephemeral: true,
        content: `返信を送信しました。`
      });
    } catch (e) {
      console.error('メッセージ送信に失敗しました:', e);
      await interaction.reply({
        ephemeral: true,
        content: `メッセージの送信に失敗しました: ${e.message}`
      });
    }
    //管理人室→ユーザー　送信処理
  } else if (DMmatch) {
    const content = interaction.fields.getTextInputValue('message');
    const replyable = interaction.fields.getTextInputValue('replyable');
    const user = interaction.client.users.cache.get(DMmatch[1]);
    if (!interaction.message.embeds[0]) {
      await interaction.message.fetch();
    }
const replybutton = (replyable === "0") ? null : [replyfromDM];
    try {
      const embed = new EmbedBuilder()
        .setTitle(`管理人室からのメッセージ`)
        .setDescription(content)
        .setTimestamp()
        .setColor("#FFD700")
        .setFooter({
          text: "このダイレクトメールへの書き込みには返信できません、ご了承ください"
        });
      // メッセージを指定されたチャンネルに送信
      await user.send({
        embeds: [embed],
        components: replybutton
      });
      await interaction.client.channels.cache.get(config.logch.admin).send({
        embeds: [
          new EmbedBuilder()
          .setTitle("管理者発言ログ(DM)")
          .setColor("#FFD700")
          .setDescription(`送信内容\`\`\`\n${content}\n\`\`\``)
          .setThumbnail(interaction.user.displayAvatarURL({
            dynamic: true
          }))
          .setTimestamp()
          .addFields({
            name: "送信者",
            value: `${interaction.member.displayName}(ID:${interaction.user.id})`
          }, {
            name: "送信相手",
            value: `\@${user.username} (<@${user.id}>)`
          }, {
            name: "返信されたメッセージ",
            value: interaction.message.embeds[0].description
          }, {
            name: "返信可否",
            value: `${replyable}`
          })
        ]
      });
      await interaction.reply({
        ephemeral: true,
        content: `${user.username}にメッセージを送信しました。\n送信内容\`\`\`\n${content}\n\`\`\``
      });
    } catch (e) {
      console.error('メッセージ送信に失敗しました:', e);
      await interaction.reply({
        ephemeral: true,
        content: `メッセージの送信に失敗しました: ${e.message}`
      });
    }
  } else { //モーダルが不明のとき
    return;
  }

};