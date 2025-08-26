// commands\slashs\casino.mjs
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from "discord.js";
import { Point, CasinoStats, sequelize } from "../../models/database.mjs";
import config from "../../config.mjs";

// --- ユーティリティ ---
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const data = new SlashCommandBuilder()
  .setName("casino")
  .setDescription("ニョワコインで遊べるカジノです。")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("slots")
      .setDescription("【1号機】一攫千金を夢見る最凶のスロットマシン")
      .addIntegerOption((option) =>
        option
          .setName("bet")
          .setDescription("賭けるコインの枚数(1-20)")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(20)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("slots_easy")
      .setDescription("【2号機】当たりやすい安全設計のスロットマシン")
      .addIntegerOption((option) =>
        option
          .setName("bet")
          .setDescription("賭けるコインの枚数(1-20)")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(20)
      )
  );
// --- コマンド実行部分 ---
export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "slots") {
    await handleSlots(interaction, config.casino.slot); 
  } else if (subcommand === "slots_easy") {
    await handleSlots(interaction, config.casino.slot_lowrisk); 
  }
}

// --- スロットゲームのメインロジック ---
async function handleSlots(interaction, slotConfig) {
  const betAmount = interaction.options.getInteger("bet");
  const userId = interaction.user.id;

  // セッション（連続プレイ）ごとの統計
  let sessionPlays = 0;
  let sessionProfit = 0;

  await interaction.deferReply();

  // --- ゲームループ関数 ---
  const gameLoop = async (isFirstPlay = true) => {
    let resultSymbols = [];
    let isReach = false;
    const t = await sequelize.transaction();
    try {
      const userPoint = await Point.findOne({
        where: { userId },
        transaction: t,
      });

      if (!userPoint || userPoint.coin < betAmount) {
        const message = isFirstPlay
          ? `コインが足りません！\n現在の所持${config.nyowacoin}: ${userPoint?.coin || 0}枚`
          : `コインが足りなくなったため、ゲームを終了します。`;
        await interaction.editReply({
          content: message,
          embeds: [],
          components: [],
        });
        await t.rollback();
        return "end_game";
      }

      // 賭け金を支払う
      userPoint.coin -= betAmount;

      // --- スロットの結果を先に決定 ---
      resultSymbols = [
        slotConfig.reels[0][
          Math.floor(Math.random() * slotConfig.reels[0].length)
        ],
        slotConfig.reels[1][
          Math.floor(Math.random() * slotConfig.reels[1].length)
        ],
        slotConfig.reels[2][
          Math.floor(Math.random() * slotConfig.reels[2].length)
        ],
      ];
      // 結果を絵文字に変換
      const resultEmojis = resultSymbols.map(
        (s) => slotConfig.symbols[s] || "❓"
      );
      const rotateEmoji = slotConfig.symbols.rotate;

      // --- アニメーション ---
      const embed = new EmbedBuilder()
        .setColor("#2f3136")
        .setTitle(`${slotConfig.displayname}`);

      // 1. 全て回転中
      embed.setDescription(
        `[ ${rotateEmoji} | ${rotateEmoji} | ${rotateEmoji} ]`
      );
      await interaction.editReply({ embeds: [embed], components: [] });
      await sleep(1000);

      // 2. 1番目のリールが停止
      embed.setDescription(
        `[ ${resultEmojis[0]} | ${rotateEmoji} | ${rotateEmoji} ]`
      );
      await interaction.editReply({ embeds: [embed] });
      await sleep(1000);

      // 3. 2番目のリールが停止
      // ▼▼▼ まず、基本となるリールの文字列を生成 ▼▼▼
      let description = `[ ${resultEmojis[0]} | ${resultEmojis[1]} | ${rotateEmoji} ]`;
      // ★ リーチ演出の追加 --- ここから ---
      let lastReelDelay = 1500; // 通常の待機時間
      isReach =
        resultSymbols[0] === resultSymbols[1] &&
        (resultSymbols[0] === "7" ||
          resultSymbols[0] === "watermelon" ||
          resultSymbols[0] === "bell");
      //1号機の７とスイカ、2号機のベル
      if (isReach) {
        lastReelDelay = 3000; // リーチ時の待機時間に延長
        description += `\n# ${slotConfig.symbols.reach} **リーチ！** ${slotConfig.symbols.reach}`;
      }
      // ★ リーチ演出の追加 --- ここまで ---
      // ▼▼▼ 最終的に生成した文字列で、setDescriptionを一度だけ呼ぶ ▼▼▼
      embed.setDescription(description);

      await interaction.editReply({ embeds: [embed] });
      await sleep(lastReelDelay); // 設定された待機時間だけ待つ

      // --- 役の判定とDB更新 ---
      const prize = getSlotPrize(resultSymbols, slotConfig);
      const winAmount = betAmount * prize.payout;
      userPoint.coin += winAmount;

      const [stats] = await CasinoStats.findOrCreate({
        where: { userId, gameName: slotConfig.gameName },
        transaction: t,
      });
      stats.gamesPlayed = BigInt(stats.gamesPlayed.toString()) + 1n;
      stats.totalBet = BigInt(stats.totalBet.toString()) + BigInt(betAmount);
      stats.totalWin = BigInt(stats.totalWin.toString()) + BigInt(winAmount);

      await userPoint.save({ transaction: t });
      await stats.save({ transaction: t });
      await t.commit(); // ここでDBへの変更を確定

      // セッション情報を更新
      sessionPlays++;
      sessionProfit += winAmount - betAmount;

      // --- 最終結果の表示 ---
      embed
        .setColor(winAmount > 0 ? "#57F287" : "#ED4245")
        .setDescription(
          `[ ${resultEmojis[0]} | ${resultEmojis[1]} | ${resultEmojis[2]} ]`
        )
        .setFields(
          { name: "役", value: prize.prizeName, inline: true },
          {
            name: "配当",
            value: `+${winAmount} ${config.nyowacoin}`,
            inline: true,
          },
          {
            name: `所持コイン`,
            value: `**${userPoint.coin}**${config.nyowacoin}`,
            inline: true,
          }
        )
        .setFooter({
          text: `今回のセッション: ${sessionPlays}プレイ / 損益: ${sessionProfit > 0 ? "+" : ""}${sessionProfit}コイン`,
        });

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("spin_again")
          .setLabel(`もう一度回す (${betAmount}コイン)`)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("stop_playing")
          .setLabel("やめる")
          .setStyle(ButtonStyle.Secondary)
      );

      const message = await interaction.editReply({
        embeds: [embed],
        components: [buttons],
      });

      // --- ボタン操作の待受 ---
      const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === userId,
        time: 30_000,
      });

      collector.on("collect", async (i) => {
        collector.stop();
        if (i.customId === "spin_again") {
          await i.deferUpdate();
          if ((await gameLoop(false)) === "end_game") {
            buttons.components.forEach((btn) => btn.setDisabled(true));
            await interaction.editReply({ components: [buttons] });
          }
        } else {
          buttons.components.forEach((btn) => btn.setDisabled(true));
          await i.update({ components: [buttons] });
        }
      });

      collector.on("end", (collected) => {
        if (collected.size === 0) {
          buttons.components.forEach((btn) => btn.setDisabled(true));
          interaction.editReply({ components: [buttons] }).catch(() => {});
        }
      });
    } catch (error) {
      console.error("スロット処理中にエラー:", error);
      console.error(`[Casino Error Log] エラー発生時のスロット出目と状況:`, {
        userId: userId,
        betAmount: betAmount,
        isReach: isReach,
        result: resultSymbols,
      });
      await t.rollback();
      await interaction.followUp({
        content:
          "エラーが発生したため、処理を中断しました。コインは消費されていません。",
        ephemeral: true,
      });
    }
  };

  await gameLoop(); // 最初のゲームを開始
}

/**
 * スロットの結果から役を判定し、役の情報を返します。
 * @param {string[]} result - スロットのリール結果
 * @param {object} slotConfig - 使用するスロットの設定オブジェクト
 * @returns {{ prizeId: string, prizeName: string, payout: number }} 役の情報オブジェクト
 */
// ▼▼▼ 第2引数でslotConfigを受け取るように変更 ▼▼▼
function getSlotPrize(result, slotConfig) {
  // 高配当（配列の上の方）から順にチェック
  for (const prize of slotConfig.payouts) {
    // 3つ揃いのパターンをチェック
    if (prize.pattern) {
      const isMatch = result.every(
        (symbol, index) => symbol === prize.pattern[index]
      );
      if (isMatch) {
        return {
          prizeId: prize.id,
          prizeName: prize.name,
          payout: prize.payout,
        };
      }
    }
    // 左揃えのパターンをチェック (例: チェリーx2)
    else if (prize.leftAlign && prize.symbol) {
      // 役の成立に必要な絵柄が、左から連続で揃っているか確認
      const targetSlice = result.slice(0, prize.leftAlign);
      const isMatch = targetSlice.every((s) => s === prize.symbol);

      if (isMatch) {
        return {
          prizeId: prize.id,
          prizeName: prize.name,
          payout: prize.payout,
        };
      }
    }
    /*
    // 特定シンボルの数でチェック (今は未使用)
    else if (prize.minCount && prize.symbol) {
      const count = result.filter((s) => s === prize.symbol).length;
      if (count >= prize.minCount) {
        return {
          prizeId: prize.id,
          prizeName: prize.name,
          payout: prize.payout,
        };
      }
    }
    */
  }
  // どの役にも当てはまらない場合
  return { prizeId: "none", prizeName: "ハズレ...", payout: 0 };
}
