//interactions\modalHandlers.mjs
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import config from "../config.mjs";
import {
  replytoDM,
  replyfromDM,
  createRpDeleteRequestButton,
} from "../components/buttons.mjs";
//RP機能周りimport
import { sendWebhookAsCharacter } from "../utils/webhook.mjs";
import { Character, Icon, sequelize, Point } from "../models/database.mjs";
import { updatePoints } from "../commands/slashs/roleplay.mjs"; // updatePointsをインポート
//RP周りここまで

export default async function handleModalInteraction(interaction) {
  //モーダル
  //DMやり取り系
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

      const postedMessage = await sendWebhookAsCharacter(
        interaction,
        loadchara,
        loadicon,
        message,
        nocredit
      );
      await updatePoints(interaction.user.id);

      const deleteRequestButtonRow = createRpDeleteRequestButton(
        postedMessage.id,
        interaction.user.id
      );

      await interaction.editReply({
        content: `送信しました。`,
        components: [deleteRequestButtonRow], // ★★★ これを使う ★★★
      });
    } catch (error) {
      console.error("Modalからのメッセージ送信に失敗しました:", error);
      await interaction.editReply({ content: `エラーが発生しました。` });
    }
    //両替
  } else if (
    interaction.customId === "exchange_points_submit" ||
    interaction.customId === "exchange_acorns_submit"
  ) {
    const amountStr = interaction.fields.getTextInputValue("amount_input");
    const amount = parseInt(amountStr, 10);

    if (isNaN(amount) || amount <= 0) {
      return interaction.reply({
        content: "有効な数値を入力してください。",
        ephemeral: true,
      });
    }

    try {
      const resultMessage = await sequelize.transaction(async (t) => {
        const [user] = await Point.findOrCreate({
          where: { userId: interaction.user.id },
          transaction: t,
        });

        if (interaction.customId === "exchange_points_submit") {
          if (user.point < amount)
            throw new Error("所持しているRPが足りません！");
          const coinsGained = amount * 20; //1RP20coin
          user.point -= amount;
          user.coin += coinsGained;
          await user.save({ transaction: t });
          return `💎 RP **${amount}** を ${config.nyowacoin} コイン **${coinsGained}** 枚に両替しました！`;
        } else if (interaction.customId === "exchange_acorns_submit") {
          if (user.acorn < amount)
            throw new Error("所持しているどんぐりが足りません！");
          const coinsGained = amount * 100; //1acorn 100coin
          user.acorn -= amount;
          user.coin += coinsGained;
          await user.save({ transaction: t });
          return `🐿️ どんぐり **${amount}** 個を ${config.nyowacoin} コイン **${coinsGained}** 枚に両替しました！`;
        }
      });
      await interaction.reply({
        content: `✅ **両替成功！**\n${resultMessage}`,
        ephemeral: true,
      });
    } catch (error) {
      await interaction.reply({
        content: `❌ **エラー**\n${error.message}`,
        ephemeral: true,
      });
    }
    return; // 処理が終わったので、ここで関数を抜ける
  } else {
    //モーダルが不明のとき
    return;
  }
}
