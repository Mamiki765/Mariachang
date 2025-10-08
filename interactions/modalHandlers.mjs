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
import { unlockAchievements } from "../utils/achievements.mjs";
//RP機能周りimport
import { sendWebhookAsCharacter } from "../utils/webhook.mjs";
import { Character, Icon, sequelize, Point } from "../models/database.mjs";
import { updatePoints } from "../commands/slashs/roleplay.mjs"; // updatePointsをインポート
//RP周りここまで
import { applyPizzaBonus } from "../utils/idle-game-calculator.mjs";
//コイン→ピザ交換

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
      const rewardResult = await updatePoints(
        interaction.user.id,
        interaction.client
      );

      const deleteRequestButtonRow = createRpDeleteRequestButton(
        postedMessage.id,
        interaction.user.id
      );
      let replyMessage = "送信しました。";
      if (rewardResult) {
        if (rewardResult.rewardType === "rp") {
          // 実際の絵文字IDなどに合わせて変更してください
          replyMessage += `\n💎 **RP**を1獲得しました！`;
        } else if (rewardResult.rewardType === "pizza") {
            replyMessage += `\n<:nyobochip:1416912717725438013> 連投クールダウン中です。(あと${rewardResult.cooldown}秒)\n代わりに**ニョボチップ**が**${rewardResult.amount.toLocaleString()}**枚、バンクに入金されました。`;
        }
      }
      await interaction.editReply({
        content: replyMessage,
        components: [deleteRequestButtonRow], // ★★★ これを使う ★★★
      });
    } catch (error) {
      console.error("Modalからのメッセージ送信に失敗しました:", error);
      await interaction.editReply({ content: `エラーが発生しました。` });
    }
    //両替
  } else if (
    interaction.customId === "exchange_points_submit" ||
    interaction.customId === "exchange_acorns_submit" ||
    interaction.customId === "exchange_coin_to_pizza_submit" ||
    interaction.customId === "withdraw_pizza_submit"
  ) {
    const amountStr = interaction.fields.getTextInputValue("amount_input");

    try {
      let resultMessage = "";
      let isCoinToPizzaExchange = false;
      let exchangeAmount = 0; // 実績解除用に、実際に両替したコインの量を保存

      await sequelize.transaction(async (t) => {
        const user = await Point.findOne({
          where: { userId: interaction.user.id },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!user) throw new Error("ユーザーデータが見つかりませんでした。");

        switch (interaction.customId) {
          case "exchange_points_submit": {
            const amount = parseAmount(amountStr, user.point);
            const coinsGained = amount * 20;
            user.point -= amount;
            user.coin += coinsGained;
            resultMessage = `💎 RP **${amount.toLocaleString()}** を ${config.nyowacoin} コイン **${coinsGained.toLocaleString()}** 枚に両替しました！`;
            break;
          }
          case "exchange_acorns_submit": {
            const amount = parseAmount(amountStr, user.acorn);
            const coinsGained = amount * 100;
            user.acorn -= amount;
            user.coin += coinsGained;
            resultMessage = `🐿️ どんぐり **${amount.toLocaleString()}** 個を ${config.nyowacoin} コイン **${coinsGained.toLocaleString()}** 枚に両替しました！`;
            break;
          }
          case "exchange_coin_to_pizza_submit": {
            const amount = parseAmount(amountStr, user.coin);
            const baseRate = 30;
            const basePizzaToGet = amount * baseRate;
            const finalPizzaToGet = await applyPizzaBonus(
              interaction.user.id,
              basePizzaToGet
            );
            const bonusAmount = finalPizzaToGet - basePizzaToGet;

            user.coin -= amount;
            user.legacy_pizza += finalPizzaToGet;
            resultMessage = `${config.nyowacoin}**${amount.toLocaleString()}枚**を ${config.casino.currencies.legacy_pizza.emoji}**${finalPizzaToGet.toLocaleString()}枚**に両替しました！\n(内訳: 基本${basePizzaToGet.toLocaleString()}枚 + ボーナス${bonusAmount.toLocaleString()}枚)`;

            isCoinToPizzaExchange = true;
            exchangeAmount = amount; // 実績判定用に保存
            break;
          }
          case "withdraw_pizza_submit": {
            const amount = parseAmount(amountStr, user.nyobo_bank);
            const baseRate = 1; // バンクからの引き出しは1:1
            const basePizzaToGet = amount * baseRate;
            const finalPizzaToGet = await applyPizzaBonus(
              interaction.user.id,
              basePizzaToGet
            );
            const bonusAmount = finalPizzaToGet - basePizzaToGet;

            user.nyobo_bank -= amount;
            user.legacy_pizza += finalPizzaToGet;
            resultMessage = `🏦 **${amount.toLocaleString()}枚**をバンクから引き出し、${config.casino.currencies.legacy_pizza.emoji}**${finalPizzaToGet.toLocaleString()}枚**をお財布に入れました！\n(内訳: 基本${basePizzaToGet.toLocaleString()}枚 + ボーナス${bonusAmount.toLocaleString()}枚)`;
            break;
          }
        }
        await user.save({ transaction: t });
      });

      await unlockAchievements(interaction.client, interaction.user.id, 45);
      if (isCoinToPizzaExchange && exchangeAmount === 20) {
        await unlockAchievements(interaction.client, interaction.user.id, 46);
      }

      await interaction.reply({
        content: `✅ **両替/引き出し成功！**\n${resultMessage}`,
        ephemeral: true,
      });
    } catch (error) {
      await interaction.reply({
        content: `❌ **エラー**\n${error.message}`,
        ephemeral: true,
      });
    }
    return;
  } else {
    //モーダルが不明のとき
    return;
  }
}

/**
 * "all", "half", "数値" の文字列を解釈して、処理すべき数値を返すヘルパー関数
 * @param {string} amountStr - ユーザーが入力した文字列
 * @param {number} currentBalance - その時点でのユーザーの所持量
 * @returns {number} 計算された数値
 */
function parseAmount(amountStr, currentBalance) {
  const lowerCaseStr = amountStr.toLowerCase().trim();
  let amount;

  if (lowerCaseStr === "all") {
    amount = currentBalance;
  } else if (lowerCaseStr === "half") {
    amount = Math.floor(currentBalance / 2);
  } else {
    amount = parseInt(lowerCaseStr, 10);
    if (isNaN(amount) || amount <= 0) {
      throw new Error("有効な数値を入力してください。");
    }
    if (amount > currentBalance) {
      throw new Error(
        `所持している量が足りません！(所持: ${currentBalance.toLocaleString()})`
      );
    }
  }

  if (amount <= 0) {
    throw new Error("両替/引き出し額が0です。");
  }
  return amount;
}
