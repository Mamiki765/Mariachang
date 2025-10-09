import {
  SlashCommandBuilder,
  ModalBuilder,
  LabelBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
} from "discord.js";
import { Point, IdleGame, sequelize } from "../../models/database.mjs";
import {
  getPizzaBonusMultiplier,
  applyPizzaBonus,
} from "../../utils/idle-game-calculator.mjs";
import { unlockAchievements } from "../../utils/achievements.mjs";
import config from "../../config.mjs";

//14.23.0の新modalはhttps://modal.builders/で確認できる

// 開発環境でのみ登録
export const scope = "debug";

export const help = {
  category: "slash",
  description: "どんぐりやニョワコイン等の雨宿り通貨を両替します",
  notes: "Mee6経験値の受領申請や一部通貨の贈与も予定",
};

export const data = new SlashCommandBuilder()
  .setName("bank")
  .setDescription("通貨の確認や両替、引き出しなどを行います。");

export async function execute(interaction) {
  try {
    const userId = interaction.user.id;
    const [user] = await Point.findOrCreate({ where: { userId } });
    const idleGame = await IdleGame.findOne({ where: { userId } });
    const finalRate = 30 * (await getPizzaBonusMultiplier(userId));
    const bonusText =
      idleGame && idleGame.pizzaBonusPercentage > 0
        ? ` (引き出し時、+${idleGame.pizzaBonusPercentage.toFixed(3)}%)`
        : "";
    // =================================================
    // ▼▼▼ ステップ1: モーダルの構築と表示 ▼▼▼
    // =================================================
    const modal = new ModalBuilder()
      .setCustomId("bank_transaction_modal")
      .setTitle(`👛 ${interaction.user.username} さんの財布`)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `### あなたの資産状況\n` +
            `💎 RoleplayPoint: **${user.point.toLocaleString()}**\n` +
            `🐿️ あまやどんぐり: **${user.acorn.toLocaleString()}**\n` +
            `${config.nyowacoin} ニョワコイン: **${user.coin.toLocaleString()}**\n` +
            `${config.casino.currencies.legacy_pizza.emoji} ニョボチップ: **${user.legacy_pizza.toLocaleString()}**\n` +
            `🏦 ニョボバンク: **${user.nyobo_bank.toLocaleString()}**`
        )
      )
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("実行したい取引を選択してください")
          .setStringSelectMenuComponent(
            new StringSelectMenuBuilder()
              .setCustomId("bank_action_select") // ★ このIDを使う
              .setPlaceholder("取引内容を選択...")
              .addOptions(
                new StringSelectMenuOptionBuilder()
                  .setLabel(`RPをコインに両替 (1 -> 20)`)
                  .setValue("exchange_rp"),
                new StringSelectMenuOptionBuilder()
                  .setLabel(`どんぐりをコインに両替 (1 -> 100)`)
                  .setValue("exchange_acorn"),
                new StringSelectMenuOptionBuilder()
                  .setLabel(
                    `コインをチップに両替 (1 -> ${finalRate.toFixed(2)})`
                  )
                  .setDescription(
                    "ニョボバンクに行かず、即座にボーナス換算後お財布に入ります"
                  )
                  .setValue("exchange_coin_to_pizza")
                  /*,
                new StringSelectMenuOptionBuilder()
                  .setLabel(`チップを引き出す${bonusText}`)
                  .setValue("withdraw_pizza"),
                new StringSelectMenuOptionBuilder()
                  .setLabel("Mee6経験値にする(1000coin -> 1000XP)")
                  .setValue("df899985dcd349d99a72d72202714abf")
                  .setDescription(
                    "この経験値でレベルアップをしても通知が出ません。数量指定はできません。"
                  ),
                new StringSelectMenuOptionBuilder()
                  .setLabel("ニョボバンクの中身を他人に送金する")
                  .setValue("hogehoge")
                  .setDescription("送金元あるいは送金先がサブ垢の場合は使用ができません")//ロールID:1040148957369737278*/
              )
          )
      )
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("数量")
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId("bank_amount_input")
              .setStyle(TextInputStyle.Short)
              .setPlaceholder("'half'や'all'も使えます")
              .setRequired(true)
          )
      );

    await interaction.showModal(modal);

    const submitted = await interaction
      .awaitModalSubmit({
        time: 300_000,
        filter: (i) => i.user.id === interaction.user.id,
      })
      .catch(() => null);

    if (submitted) {
      const selectedAction =
        submitted.fields.getStringSelectValues("bank_action_select")[0];
      const amountRaw = submitted.fields.getTextInputValue("bank_amount_input");
      const userId = submitted.user.id;

      try {
        await submitted.deferReply({ ephemeral: true });

        let resultMessage = "";
        let isCoinToPizzaExchange = false;
        let exchangeAmount = 0;

        // ▼▼▼ ここから modalHandlers.mjs のロジックを移植 ▼▼▼
        await sequelize.transaction(async (t) => {
          const user = await Point.findOne({
            where: { userId: userId },
            transaction: t,
            lock: t.LOCK.UPDATE,
          });
          if (!user) throw new Error("ユーザーデータが見つかりませんでした。");

          switch (
            selectedAction // interaction.customId を selectedAction に変更
          ) {
            case "exchange_rp": {
              // "exchange_points_submit" を "exchange_rp" に変更
              const amount = parseAmount(amountRaw, user.point);
              const coinsGained = amount * 20;
              user.point -= amount;
              user.coin += coinsGained;
              resultMessage = `💎 RP **${amount.toLocaleString()}** を ${config.nyowacoin} コイン **${coinsGained.toLocaleString()}** 枚に両替しました！`;
              break;
            }
            case "exchange_acorn": {
              // "exchange_acorns_submit" を "exchange_acorn" に変更
              const amount = parseAmount(amountRaw, user.acorn);
              const coinsGained = amount * 100;
              user.acorn -= amount;
              user.coin += coinsGained;
              resultMessage = `🐿️ どんぐり **${amount.toLocaleString()}** 個を ${config.nyowacoin} コイン **${coinsGained.toLocaleString()}** 枚に両替しました！`;
              break;
            }
            case "exchange_coin_to_pizza": {
              // "exchange_coin_to_pizza_submit" を "exchange_coin_to_pizza" に変更
              const amount = parseAmount(amountRaw, user.coin);
              const baseRate = 30;
              const basePizzaToGet = amount * baseRate;
              const finalPizzaToGet = await applyPizzaBonus(
                userId,
                basePizzaToGet
              );
              const bonusAmount = finalPizzaToGet - basePizzaToGet;

              user.coin -= amount;
              user.legacy_pizza += finalPizzaToGet;
              resultMessage = `${config.nyowacoin}**${amount.toLocaleString()}枚**を ${config.casino.currencies.legacy_pizza.emoji}**${finalPizzaToGet.toLocaleString()}枚**に両替しました！\n(内訳: 基本${basePizzaToGet.toLocaleString()}枚 + ボーナス${bonusAmount.toLocaleString()}枚)`;

              isCoinToPizzaExchange = true;
              exchangeAmount = amount;
              break;
            }
            case "withdraw_pizza": {
              // "withdraw_pizza_submit" を "withdraw_pizza" に変更
              const amount = parseAmount(amountRaw, user.nyobo_bank);
              const basePizzaToGet = amount * 1; // 1:1
              const finalPizzaToGet = await applyPizzaBonus(
                userId,
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

        // 実績解除
        await unlockAchievements(submitted.client, userId, 45);
        if (isCoinToPizzaExchange && exchangeAmount === 20) {
          await unlockAchievements(submitted.client, userId, 46);
        }

        // 成功メッセージ
        await submitted.editReply({
          content: `✅ **両替/引き出し成功！**\n${resultMessage}`,
        });
      } catch (error) {
        // エラーメッセージ
        await submitted.editReply({
          content: `❌ **エラー**\n${error.message}`,
        });
      }
    }
  } catch (error) {
    console.error("バンクコマンドの実行中にエラー:", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "処理中にエラーが発生しました。",
        ephemeral: true,
      });
    }
  }
}

// ▼▼▼ modalHandlers.mjs からヘルパー関数を移植 ▼▼▼
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
