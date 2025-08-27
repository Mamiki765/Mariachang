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
  //スロット1号機
  .addSubcommand((subcommand) =>
    subcommand
      .setName("slots")
      .setDescription("【スロット1号機】一攫千金を夢見る最凶のマシン")
      .addIntegerOption((option) =>
        option
          .setName("bet")
          .setDescription("賭けるコインの枚数(1-20)")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(20)
      )
  )
  //スロット２号機
  .addSubcommand((subcommand) =>
    subcommand
      .setName("slots_easy")
      .setDescription("【2号機】当たりやすい安全設計のマシン")
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
      .setName("balance")
      .setDescription("コインや他の通貨を確認したり両替できます")
  );

// --- コマンド実行部分 ---
export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "slots") {
    await handleSlots(interaction, config.casino.slot);
  } else if (subcommand === "slots_easy") {
    await handleSlots(interaction, config.casino.slot_lowrisk);
  } else if (subcommand === "balance") {
    await handleBalance(interaction);
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
          : `コインが足りなくなったため、ゲームを終了します。\n-# /exchange(経済) transferでどんぐりやRPをコインに交換できます。`;
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
        `# [ ${rotateEmoji} | ${rotateEmoji} | ${rotateEmoji} ]`
      );
      await interaction.editReply({ embeds: [embed], components: [] });
      await sleep(1000);

      // 2. 1番目のリールが停止
      embed.setDescription(
        `# [ ${resultEmojis[0]} | ${rotateEmoji} | ${rotateEmoji} ]`
      );
      await interaction.editReply({ embeds: [embed] });
      await sleep(1000);

      // 3. 2番目のリールが停止
      // ▼▼▼ まず、基本となるリールの文字列を生成 ▼▼▼
      let description = `# [ ${resultEmojis[0]} | ${resultEmojis[1]} | ${rotateEmoji} ]`;
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
          `# [ ${resultEmojis[0]} | ${resultEmojis[1]} | ${resultEmojis[2]} ]`
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
          .setLabel(`${betAmount}コインで更に回す`)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("stop_playing")
          .setLabel("やめる")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("show_payouts")
          .setLabel("役の一覧")
          .setStyle(ButtonStyle.Success)
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
        if (i.customId === "spin_again") {
          collector.stop();
          await i.deferUpdate();
          if ((await gameLoop(false)) === "end_game") {
            buttons.components.forEach((btn) => btn.setDisabled(true));
            await interaction.editReply({ components: [buttons] });
          }
        } else if (i.customId === "show_payouts") {
          // ▼▼▼ 役一覧表示の処理 ▼▼▼

          // 1. configから役一覧のテキストを生成
          let payoutsText = `**${slotConfig.displayname} 役の一覧**\n\n`;
          for (const prize of slotConfig.payouts) {
            // display があれば表示し、なければ名前にする
            const displayEmoji = prize.display
              ? `${prize.display} `
              : `${prize.name}`;
            payoutsText += `**${displayEmoji}**: ${prize.payout}倍\n`;
          }

          // 2. 「あなただけに表示」(ephemeral)で返信する
          await i.reply({
            content: payoutsText,
            flags: 64,
          });
        } else {
          buttons.components.forEach((btn) => btn.setDisabled(true));
          await i.update({ components: [buttons] });
          collector.stop();
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

//balance
async function handleBalance(interaction) {
  const userId = interaction.user.id;
  try {
    const [user] = await Point.findOrCreate({ where: { userId } });

    const embed = new EmbedBuilder()
      .setTitle(`👛 ${interaction.user.username} さんの財布`)
      .setColor("#FEE75C")
      .addFields(
        { name: "💎 Roleplay Point", value: `**${user.point}**RP`, inline: false },
        { name: "🐿️ あまやどんぐり", value: `**${user.acorn}**個`, inline: false },
        { name: `${config.nyowacoin} ニョワコイン`, value: `**${user.coin}**枚`, inline: false }
      )
      .setTimestamp();

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("exchange_points_modal")
        .setLabel("1RP -> 20ｺｲﾝ")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("exchange_acorns_modal")
        .setLabel("1どんぐり -> 100ｺｲﾝ")
        .setStyle(ButtonStyle.Success)
    );
    
    // ephemeral: true で本人にだけ表示する
    const message = await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
    
    // Modalを呼び出すためのコレクター
    const collector = message.createMessageComponentCollector({
      filter: i => i.user.id === userId,
      time: 60_000, // 60秒間操作を待つ
    });

    collector.on('collect', async i => {
      // どのボタンが押されたかで、表示するModalを切り替える
      const modal = new ModalBuilder();
      const amountInput = new TextInputBuilder()
        .setCustomId('amount_input')
        .setLabel("両替したい量")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      if (i.customId === 'exchange_points_modal') {
        modal.setCustomId('exchange_points_submit').setTitle('RP → コイン');
        amountInput.setPlaceholder('例: 10');
      } else if (i.customId === 'exchange_acorns_modal') {
        modal.setCustomId('exchange_acorns_submit').setTitle('どんぐり → コイン');
        amountInput.setPlaceholder('例: 5');
      }

      modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
      await i.showModal(modal);
      
      // Modalを表示したら、コレクターの役目は終わり
      collector.stop();
    });

    collector.on('end', () => {
      // タイムアウトしたらボタンを無効化
      buttons.components.forEach(btn => btn.setDisabled(true));
      interaction.editReply({ components: [buttons] }).catch(()=>{});
    });

  } catch (error) {
    console.error("残高の取得中にエラー:", error);
    await interaction.reply({ content: "残高の取得に失敗しました。", ephemeral: true });
  }
}