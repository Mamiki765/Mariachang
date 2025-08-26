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

// --- 設定ファイルのショートカット ---
const slotConfig = config.casino.slot;
// --- ユーティリティ ---
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const data = new SlashCommandBuilder()
  .setName("casino")
  .setDescription("ニョワコインで遊べるカジノです。")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("slots")
      .setDescription("スロットマシンをプレイします。")
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
  if (interaction.options.getSubcommand() === "slots") {
    await handleSlots(interaction);
  }
}

// --- スロットゲームのメインロジック ---
async function handleSlots(interaction) {
  const betAmount = interaction.options.getInteger("bet");
  const userId = interaction.user.id;

  // セッション（連続プレイ）ごとの統計
  let sessionPlays = 0;
  let sessionProfit = 0;

  await interaction.deferReply();

  // --- ゲームループ関数 ---
  const gameLoop = async (isFirstPlay = true) => {
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
      const resultSymbols = [
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
        .setTitle("スロットマシン");

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
      embed.setDescription(
        `[ ${resultEmojis[0]} | ${resultEmojis[1]} | ${rotateEmoji} ]`
      );
      // ★ リーチ演出の追加 --- ここから ---
      let lastReelDelay = 1500; // 通常の待機時間
      const isReach = resultSymbols[0] === resultSymbols[1] && 
                      (resultSymbols[0] === '7' || resultSymbols[0] === 'watermelon');

      if (isReach) {
        lastReelDelay = 3000; // リーチ時の待機時間に延長
        embed.setFooter({ text: `${slotConfig.symbols.reach} リーチ！ ${slotConfig.symbols.reach}` });
      }
      // ★ リーチ演出の追加 --- ここまで ---
      
      await interaction.editReply({ embeds: [embed] });
      await sleep(lastReelDelay); // 設定された待機時間だけ待つ

      // --- 役の判定とDB更新 ---
      const prize = getSlotPrize(resultSymbols);
      const winAmount = betAmount * prize.payout;
      userPoint.coin += winAmount;

      const [stats] = await CasinoStats.findOrCreate({
        where: { userId, gameName: "slots" },
        transaction: t,
      });
      stats.gamesPlayed = BigInt(stats.gamesPlayed) + 1n; // BigIntの計算
      stats.totalBet = BigInt(stats.totalBet) + BigInt(betAmount);
      stats.totalWin = BigInt(stats.totalWin) + BigInt(winAmount);

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
          { name: "配当", value: `+${winAmount} ${config.nyowacoin}`, inline: true },
          {
            name: `所持コイン`,
            value: `**${userPoint.coin}**${config.nyowacoin}`, 
            inline: true,
          }
        )
        .setFooter({
          text: `今回のセッション: ${sessionPlays}プレイ / 損益: ${sessionProfit > 0 ? "+" : ""}${sessionProfit}${config.nyowacoin}`,
        });

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("spin_again")
          .setLabel(`もう一度回す (${betAmount}${config.nyowacoin})`)
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
 * @param {string[]} result - スロットのリール結果 (例: ['cherry', 'cherry', 'lemon'])
 * @returns {{ prizeId: string, prizeName: string, payout: number }} 役の情報オブジェクト
 */
function getSlotPrize(result) {
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
    // 特定シンボルの数でチェック (チェリーx2など)
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
  }
  // どの役にも当てはまらない場合
  return { prizeId: "none", prizeName: "ハズレ...", payout: 0 };
}
