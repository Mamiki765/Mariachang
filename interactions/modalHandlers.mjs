//interactions\modalHandlers.mjs
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import config from "../config.mjs";
import { replytoDM, replyfromDM } from "../components/buttons.mjs";
//RP機能周り
import { getWebhookPair } from "../utils/webhook.mjs";
import { Character, Icon, Point } from "../models/database.mjs";
import { dominoeffect } from "../commands/utils/domino.mjs";
import { updatePoints } from "../commands/slashs/roleplay.mjs"; // updatePointsをインポート
//RP周りここまで

export default async function handleModalInteraction(interaction) {
  //モーダル
  const DMregex = /^admin_replytoDM_submit-(\d+)$/;
  const DMmatch = interaction.customId.match(DMregex);
  //管理人室とやりとり（ユーザー→モデレーター)
  if (interaction.customId == "admin_replyfromDM_submit") {
    const content = interaction.fields.getTextInputValue("message");
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
            .setThumbnail(
              interaction.user.displayAvatarURL({
                dynamic: true,
              })
            )
            .setTimestamp()
            .addFields(
              {
                name: "送信者",
                value: `${interaction.user.displayName}(ID:${interaction.user.id})`,
              },
              {
                name: "返信されたメッセージ",
                value: interaction.message.embeds[0].description,
              }
            ),
        ],
        components: [component],
      });
      // ボタンを消す
      const disabledButton = new ButtonBuilder()
        .setCustomId("siyoudumi")
        .setLabel("送信しました")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);
      const newRow = new ActionRowBuilder().addComponents(disabledButton);
      await interaction.message.edit({
        components: [newRow],
      });
      //送信内容をここに表示
      await interaction.user.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("管理人室への返信")
            .setColor("#B78CFE")
            .setDescription(`\`\`\`\n${content}\n\`\`\``)
            .setTimestamp(),
        ],
      });
      //完了報告
      await interaction.reply({
        flags: 64, //ephemeral
        content: `返信を送信しました。`,
      });
    } catch (e) {
      console.error("メッセージ送信に失敗しました:", e);
      await interaction.reply({
        flags: 64, //ephemeral
        content: `メッセージの送信に失敗しました: ${e.message}`,
      });
    }
    //管理人室→ユーザー　送信処理
  } else if (DMmatch) {
    const content = interaction.fields.getTextInputValue("message");
    const replyable = interaction.fields.getTextInputValue("replyable");
    const user = await interaction.client.users
      .fetch(DMmatch[1])
      .catch(() => null);
    if (!user) {
      return interaction.reply({
        content:
          "エラー: 返信先のユーザーが見つかりませんでした。すでにサーバーを抜けているか、アカウントが削除された可能性があります。",
        ephemeral: true,
      });
    }
    if (!interaction.message.embeds[0]) {
      await interaction.message.fetch();
    }
    const replybutton = replyable === "0" ? null : [replyfromDM];
    try {
      const embed = new EmbedBuilder()
        .setTitle(`管理人室からのメッセージ`)
        .setDescription(content)
        .setTimestamp()
        .setColor("#FFD700")
        .setFooter({
          text: "このダイレクトメールへの書き込みには返信できません、ご了承ください",
        });
      // メッセージを指定されたチャンネルに送信
      await user.send({
        embeds: [embed],
        components: replybutton,
      });
      await interaction.client.channels.cache.get(config.logch.admin).send({
        embeds: [
          new EmbedBuilder()
            .setTitle("管理者発言ログ(DM)")
            .setColor("#FFD700")
            .setDescription(`送信内容\`\`\`\n${content}\n\`\`\``)
            .setThumbnail(
              interaction.user.displayAvatarURL({
                dynamic: true,
              })
            )
            .setTimestamp()
            .addFields(
              {
                name: "送信者",
                value: `${interaction.member.displayName}(ID:${interaction.user.id})`,
              },
              {
                name: "送信相手",
                value: `\@${user.username} (<@${user.id}>)`,
              },
              {
                name: "返信されたメッセージ",
                value: interaction.message.embeds[0].description,
              },
              {
                name: "返信可否",
                value: `${replyable}`,
              }
            ),
        ],
      });
      await interaction.reply({
        flags: 64, //ephemeral
        content: `${user.username}にメッセージを送信しました。\n送信内容\`\`\`\n${content}\n\`\`\``,
      });
    } catch (e) {
      console.error("メッセージ送信に失敗しました:", e);
      await interaction.reply({
        flags: 64, //ephemeral
        content: `メッセージの送信に失敗しました: ${e.message}`,
      });
    }
  } else if (interaction.customId.startsWith("roleplay-post-modal_")) {
    // このモーダルからの送信には少し時間がかかるので、応答を遅延させます。
    await interaction.deferReply({ ephemeral: true });

    try {
      // 1. customIdからスロット番号とnocreditフラグを解析します。
      const parts = interaction.customId.split("_");
      const slot = parseInt(parts[1], 10);
      const nocredit = parts[2] === "true";

      // 2. モーダルの入力欄からメッセージ内容を取得します。
      const message = interaction.fields.getTextInputValue("messageInput");

      // 3. データベースからキャラクター情報を読み込みます。
      const charaslot = `${interaction.user.id}${slot > 0 ? `-${slot}` : ""}`;
      const loadchara = await Character.findOne({
        where: { userId: charaslot },
      });
      const loadicon = await Icon.findOne({ where: { userId: charaslot } });

      if (!loadchara) {
        return interaction.editReply({
          content: `エラー：スロット${slot}のキャラクターが見つかりませんでした。`,
        });
      }

      // --- 4. ここからが、パターンCと同じWebhook送信処理 ---
      let name = loadchara.name;
      let pbwflag = loadchara.pbwflag;
      let face = loadicon ? loadicon.iconUrl : null;
      let copyright = loadicon ? loadicon.illustrator : null;

      if (pbwflag.includes("illustratorname")) {
        pbwflag = pbwflag.replace("illustratorname", copyright);
      } else {
        return interaction.editReply({
          content: `大変お手数をおかけしますが、再度キャラを登録し直してください`,
        });
      }

      let finalMessage = message
        .replace(/@@@/g, "\n")
        .replace(/<br>/g, "\n")
        .replace(/\\n/g, "\n");

      if (!nocredit) {
        finalMessage += "\n" + `-# ` + pbwflag;
      }

      // Webhookのペアを取得し、最後の投稿者と被らないように交互に使い分けます。
      const webhookTargetChannel = interaction.channel.isThread()
        ? interaction.channel.parent
        : interaction.channel;
      const threadId = interaction.channel.isThread()
        ? interaction.channel.id
        : null;
      const { hookA, hookB } = await getWebhookPair(webhookTargetChannel);
      const lastMessages = await interaction.channel.messages.fetch({
        limit: 1,
      });
      const lastMessage = lastMessages.first();
      let webhookToUse = hookA;
      if (
        lastMessage &&
        lastMessage.webhookId &&
        lastMessage.webhookId === hookA.id
      ) {
        webhookToUse = hookB;
      }

      // Webhookを使ってメッセージを送信します。
      const postmessage = await webhookToUse.send({
        content: finalMessage,
        username: name,
        threadId: threadId,
        avatarURL: face,
      });

      // ドミノ機能やポイント更新などの追加処理
      if (
        finalMessage.match(/(どみの|ドミノ|ﾄﾞﾐﾉ|domino|ドミドミ|どみどみ)/i) ||
        interaction.channel.id === config.dominoch
      ) {
        dominoeffect(
          postmessage,
          interaction.client,
          interaction.user.id,
          interaction.user.username,
          name
        );
      }
      await updatePoints(interaction.user.id);

      // ユーザーに完了を通知します。
      await interaction.editReply({ content: `送信しました` });
    } catch (error) {
      console.error("Modalからのメッセージ送信に失敗しました:", error);
      await interaction.editReply({ content: `エラーが発生しました。` });
    }
  } else {
    //モーダルが不明のとき
    return;
  }
}
