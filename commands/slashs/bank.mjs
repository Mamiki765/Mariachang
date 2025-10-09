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


export const help = {
  category: "slash",
  description: "どんぐりやニョワコイン等の雨宿り通貨を両替します",
  notes: "Mee6経験値の受領申請や一部通貨の贈与もできます",
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
                  //.setEmoji("💎")
                  .setValue("exchange_rp"),
                new StringSelectMenuOptionBuilder()
                  .setLabel(`どんぐりをコインに両替 (1 -> 100)`)
                  //.setEmoji("🐿️")
                  .setValue("exchange_acorn"),
                new StringSelectMenuOptionBuilder()
                  .setLabel(
                    `コインをチップに両替 (1 -> ${finalRate.toFixed(2)})`
                  )
                  //.setEmoji("1407422205624844288")
                  .setDescription(
                    "ニョボバンクに行かず、即座にボーナス換算後お財布に入ります"
                  )
                  .setValue("exchange_coin_to_pizza"),
                new StringSelectMenuOptionBuilder()
                  .setLabel(`チップを引き出す${bonusText}`)
                  //.setEmoji("🏦")
                  .setValue("withdraw_pizza"),
                new StringSelectMenuOptionBuilder()
                  .setLabel("Mee6経験値にする(1000coin -> 1000XP)")
                  //.setEmoji("⚡️")
                  .setValue("exchange_coin_to_xp")
                  .setDescription(
                    "この経験値でレベルアップをしても通知が出ません。数量指定はできません。"
                  ),
                new StringSelectMenuOptionBuilder()
                  .setLabel("チップを他人に送金する(ニョボバンクのみ)")
                  .setValue("send_nyobobank")
                  .setDescription(
                    "送金元あるいは送金先がサブ垢の場合は使用ができません"
                  )
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
              .setPlaceholder("'half'や'all'も使えます（空欄で1）")
              .setRequired(false)
          )
      )
      .addLabelComponents(
        new LabelBuilder()
          .setLabel("送金相手 (バンク送金の場合のみ)")
          .setUserSelectMenuComponent(
            new UserSelectMenuBuilder()
              .setCustomId("bank_target_user_select") // IDを設定
              .setPlaceholder("チップを送る相手を選んでください")
              .setMaxValues(1) //1人
              .setRequired(false) // 送金以外の取引では不要なのでfalseに
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
            case "exchange_coin_to_xp": {
              // Mee6経験値のvalue
              const cost = 1000;
              const mee6RoleId = "1413916213532295345"; // configから取るのが望ましい

              // amountRawを無視し、コストだけで判定
              const user = await Point.findOne({ where: { userId: userId } });
              if (!user || user.coin < cost) {
                throw new Error(
                  `コインが足りません！ (必要: ${cost} / 所持: ${user?.coin || 0})`
                );
              }

              // ★★★ ここから下のロジックは、ボタンハンドラーからそのまま持ってくる ★★★

              // 1. コインを引く (トランザクション内で行うのがより安全)
              user.coin -= cost;

              // 2. Discordにロールを付与
              await submitted.member.roles.add(mee6RoleId);

              // 3. DB変更を保存 (トランザクション内で行う)
              await user.save({ transaction: t }); // tを渡す

              resultMessage = `✅ **両替成功！**\n${config.nyowacoin}**${cost}枚**を **Mee6経験値${cost}** に変換しました！\nMee6が経験値を付与するまで、少しお待ちください。`;

              // このcaseでは独自のメッセージを使うので、switchの外の共通メッセージは使わない
              await submitted.editReply({ content: resultMessage });
              return; // この後の共通処理をスキップするためにreturn
            }
            case "send_nyobobank": {
                    const targetUserCollection = submitted.fields.getSelectedUsers(
        "bank_target_user_select"
      );
      const targetUser = targetUserCollection.first();
              if (!targetUser) {
                throw new Error("送金相手が選択されていません。");
              }
              if (targetUser.id === userId) {
                throw new Error("自分自身に送金することはできません。");
              }
              if (targetUser.bot) {
                throw new Error("Botに送金することはできません。");
              }

              const subAccountRoleId = "1040148957369737278";
              // targetMemberの取得は不要な場合もあるので、ロールチェック時のみfetch
              const targetMember = await submitted.guild.members.fetch(
                targetUser.id
              );
              if (
                submitted.member.roles.cache.has(subAccountRoleId) ||
                targetMember.roles.cache.has(subAccountRoleId)
              ) {
                throw new Error(
                  "送金元、または送金先がサブアカウントのため、この機能は利用できません。"
                );
              }

              const amount = parseAmount(amountRaw, user.nyobo_bank);

              const [recipient] = await Point.findOrCreate({
                where: { userId: targetUser.id },
                transaction: t,
              });

              // 送金処理
              user.nyobo_bank -= amount;
              recipient.nyobo_bank += amount;

              // ▼▼▼ ここからDM通知処理を追加 ▼▼▼

              try {
                const dmEmbed = new EmbedBuilder()
                  .setTitle("🏦 ニョボバンクへの入金がありました")
                  .setDescription(
                    `${submitted.user.username} さんから、あなたのバンクにチップが送金されました。`
                  )
                  .addFields(
                    { name: "差出人", value: submitted.user.tag, inline: true },
                    {
                      name: "金額",
                      value: `**${amount.toLocaleString()}** ${config.casino.currencies.legacy_pizza.emoji}`,
                      inline: true,
                    },
                    {
                      name: "現在のバンク残高",
                      value: `**${recipient.nyobo_bank.toLocaleString()}** ${config.casino.currencies.legacy_pizza.emoji}`,
                      inline: true,
                    }
                  )
                  .setColor("#2ECC71") // 入金が分かりやすい緑色
                  .setTimestamp();

                await targetUser.send({
                  embeds: [dmEmbed],
                  flags: [4096], // 通知音を鳴らさない
                });
              } catch (dmError) {
                // DMが送れなくても処理は続行する。コンソールにログだけ残す。
                console.log(
                  `[Bank Transfer] ユーザー(ID: ${targetUser.id})へのDM送信に失敗しました。DMを拒否している可能性があります。`
                );
              }

              // ▲▲▲ DM通知処理ここまで ▲▲▲

              // データベースの変更を保存
              await recipient.save({ transaction: t });

              // 送信者への成功メッセージ
              resultMessage = `🏦 ${targetUser.username} さんに、バンクから **${amount.toLocaleString()}** チップを送金しました。`;
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
  if (amountStr === "") {
    amountStr = "1";
  }
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
