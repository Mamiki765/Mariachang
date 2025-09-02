// commands\slashs\casino.mjs
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { Point, CasinoStats, sequelize } from "../../models/database.mjs";
import config from "../../config.mjs";

export const help = {
  category: "slash",
  subcommands: [
    {
      name: "slots",
      description: "スロット1号機",
      notes: "滅多に当たりませんが最大500倍配当もあるスロットです",
    },
    {
      name: "slots_easy",
      description: "スロット2号機",
      notes: "当選率が高くコツコツ当たるスロットです",
    },
    {
      name: "blackjack",
      description: "ブラックジャックです。",
      notes: "ボーナスがあったり難易度の低い設計になっております。",
    },
  ],
};

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
  )
  //ブラックジャック
  .addSubcommand((subcommand) =>
    subcommand
      .setName("blackjack")
      .setDescription("マリアとブラックジャックで勝負！")
      .addIntegerOption((option) =>
        option
          .setName("bet")
          .setDescription(
            `賭けるコインの枚数 (${config.casino.blackjack.betting.min}~${config.casino.blackjack.betting.max}枚, ${config.casino.blackjack.betting.increment}枚単位)`
          )
          .setMinValue(config.casino.blackjack.betting.min)
          .setMaxValue(config.casino.blackjack.betting.max)
          .setRequired(true)
      )
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
  } else if (subcommand === "blackjack") {
    await handleBlackjack(interaction);
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
          ? `コインが足りません！\n現在の所持${config.nyowacoin}: ${userPoint?.coin || 0}枚\n-# /casino balanceでどんぐりやRPをコインに交換できます。`
          : `コインが足りなくなったため、ゲームを終了します。\n-# /casino balanceでどんぐりやRPをコインに交換できます。`;
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
      if (resultSymbols[0] != resultSymbols[1]) {
        //リーチでないなら待たせない
        lastReelDelay = 1000;
      }
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

      // 役が決まったら、ハズレ("none")以外はすべて記録する
      if (prize.prizeId !== "none") {
        // 1. gameDataを取得 (なければ空のオブジェクト{})
        const currentData = stats.gameData || {};

        // 2. "wins_ watermelon" のように、動的にキーを生成
        const prizeKey = `wins_${prize.prizeId}`;

        // 3. 対応する役のカウンターを+1する
        currentData[prizeKey] = (currentData[prizeKey] || 0) + 1;

        // 4. 更新したデータをセットし直し、変更を通知する
        stats.gameData = currentData;
        stats.changed("gameData", true);
      }
      
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
        {
          name: "💎 Roleplay Point",
          value: `**${user.point}**RP (累計${user.totalpoint})`,
          inline: false,
        },
        {
          name: "🐿️ あまやどんぐり",
          value: `**${user.acorn}**個 (累計${user.totalacorn})`,
          inline: false,
        },
        {
          name: `${config.nyowacoin} ニョワコイン`,
          value: `**${user.coin}**枚`,
          inline: false,
        }
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
    const message = await interaction.reply({
      embeds: [embed],
      components: [buttons],
      flags: 64,
    });

    // Modalを呼び出すためのコレクター
    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === userId,
      time: 60_000, // 60秒間操作を待つ
    });

    collector.on("collect", async (i) => {
      // どのボタンが押されたかで、表示するModalを切り替える
      const modal = new ModalBuilder();
      const amountInput = new TextInputBuilder()
        .setCustomId("amount_input")
        .setLabel("両替したい量")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      if (i.customId === "exchange_points_modal") {
        modal.setCustomId("exchange_points_submit").setTitle("RP → コイン");
        amountInput.setPlaceholder("例: 10");
      } else if (i.customId === "exchange_acorns_modal") {
        modal
          .setCustomId("exchange_acorns_submit")
          .setTitle("どんぐり → コイン");
        amountInput.setPlaceholder("例: 5");
      }

      modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
      await i.showModal(modal);

      // Modalを表示したら、コレクターの役目は終わり
      collector.stop();
    });

    collector.on("end", () => {
      // タイムアウトしたらボタンを無効化
      buttons.components.forEach((btn) => btn.setDisabled(true));
      interaction.editReply({ components: [buttons] }).catch(() => {});
    });
  } catch (error) {
    console.error("残高の取得中にエラー:", error);
    await interaction.reply({
      content: "残高の取得に失敗しました。",
      ephemeral: true,
    });
  }
}

// ==================================================================
//
//                        ブラックジャック機能
//
// ==================================================================

async function handleBlackjack(interaction) {
  const bjConfig = config.casino.blackjack;
  const betAmount = interaction.options.getInteger("bet");
  const userId = interaction.user.id;

  // 1. 賭け金のバリデーション
  const { min, max, increment } = bjConfig.betting;
  if (betAmount < min || betAmount > max || betAmount % increment !== 0) {
    return interaction.reply({
      content: `賭け金は${min}～${max}枚の範囲で、${increment}枚単位で入力してください。`,
      ephemeral: true,
    });
  }

  await interaction.deferReply();
  try {
    let activeGame;
    // --- DB操作の実行 ---
    // DB操作だけを別のtry-catchで囲み、トランザクションの範囲を限定する
    const t = await sequelize.transaction();
    try {
      const userPoint = await Point.findOne({
        where: { userId },
        transaction: t,
      });
      const [stats] = await CasinoStats.findOrCreate({
        where: { userId, gameName: bjConfig.gameName },
        transaction: t,
      });

      if (stats.gameData && stats.gameData.active_game) {
        await t.rollback();
        return interaction.editReply({
          content:
            "現在進行中のブラックジャックのゲームがあります。まずはそちらを終了させてください。",
        });
      }
      if (!userPoint || userPoint.coin < betAmount) {
        await t.rollback();
        throw new Error("コインが足りません！");
      }

      // ゲームの初期化
      userPoint.coin -= betAmount;
      const deck = createShuffledDeck(bjConfig.rules.deck_count);

      activeGame = {
        deck: deck,
        playerHands: [
          {
            cards: [deck.pop(), deck.pop()],
            bet: betAmount,
            status: "playing",
          },
        ],
        dealerHand: [deck.pop(), deck.pop()],
        currentHandIndex: 0,
      };

      // データベースにゲーム状態を保存 (initialGameData を activeGame に変更)
      const persistentData = stats.gameData || {};
      persistentData.active_game = activeGame;
      stats.gameData = persistentData;
      stats.totalBet = BigInt(stats.totalBet.toString()) + BigInt(betAmount);
      stats.changed("gameData", true); //jsonの更新を通知

      await userPoint.save({ transaction: t });
      await stats.save({ transaction: t });

      // 初手でBJか判定
      const playerValue = getHandValue(activeGame.playerHands[0].cards);
      const dealerValue = getHandValue(activeGame.dealerHand);

      if (playerValue.value === 21 || dealerValue.value === 21) {
        // BJなら、このトランザクションtを使って決着処理を行い、ここで処理を終える
        // handleDealerTurnAndSettle内でcommitまで行われる
        await handleDealerTurnAndSettle(
          interaction,
          stats,
          { active_game: activeGame },
          bjConfig,
          t
        );
        return; // ★重要: 決着したらここで抜ける
      }

      // 通常通りゲームが始まるなら、DBへの変更を確定
      await t.commit();
    } catch (dbError) {
      await t.rollback(); // DB操作中にエラーが起きたらロールバック
      throw dbError; // エラーを外側のcatchに投げる
    }

    // --- ここからはトランザクションの外 ---
    // DB操作が成功した場合のみ、この部分が実行される

    // メモリ上にある最新の activeGame を使ってEmbedとButtonを作成
    const embed = renderGameEmbed(activeGame, interaction.user, bjConfig);
    const buttons = createActionButtons(
      activeGame.playerHands[0],
      bjConfig.rules,
      activeGame.playerHands.length
    );
    const message = await interaction.editReply({
      embeds: [embed],
      components: [buttons],
    });

    // ボタン操作の受付開始
    await startInteractionCollector(message, interaction, bjConfig);
  } catch (error) {
    // 全体で発生したエラー（DBエラー含む）をここで最終的に処理する
    console.error("BJ開始エラー:", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction
        .reply({ content: `エラー: ${error.message}`, ephemeral: true })
        .catch(() => {});
    } else {
      await interaction
        .editReply({
          content: `エラー: ${error.message}`,
          embeds: [],
          components: [],
        })
        .catch(() => {});
    }
  }
}

// ▼▼▼ ボタン操作を待ち受ける心臓部 ▼▼▼
async function startInteractionCollector(message, interaction, bjConfig) {
  const userId = interaction.user.id;

  const collector = message.createMessageComponentCollector({
    filter: (i) => i.user.id === userId,
    time: 120_000, // 2分間操作がなければタイムアウト
  });

  collector.on("collect", async (i) => {
    // ボタンが押されたら、まず応答を遅延させるのがマナー
    await i.deferUpdate();

    // データベース操作は必ずトランザクションで囲む
    const t = await sequelize.transaction();
    try {
      // 最新のゲーム状態をデータベースから取得
      const stats = await CasinoStats.findOne({
        where: { userId, gameName: bjConfig.gameName },
        transaction: t,
      });
      const gameData = stats.gameData || {}; // gameDataがnullの場合も考慮
      // 進行中のゲームが存在しない場合は、ボタンを押したユーザーに通知して処理を安全に中断する
      if (!gameData.active_game) {
        await t.rollback(); // トランザクションは何もしていないので閉じる
        await i.editReply({
          content: "このゲームは既に終了しています。",
          embeds: [],
          components: [],
        });
        collector.stop(); // コレクターを停止して、これ以上ボタンを押せなくする
        return; // ここで処理を終了！
      }
      let activeGame = gameData.active_game;
      let currentHand = activeGame.playerHands[activeGame.currentHandIndex];

      // ===================================
      // ▼▼▼ プレイヤーのアクション処理 ▼▼▼
      // ===================================
      if (i.customId === "bj_hit") {
        // 1. 山札からカードを1枚引いて、手札に加える
        currentHand.cards.push(activeGame.deck.pop());

        // 2. 新しい手札の合計値を計算
        const handValue = getHandValue(currentHand.cards).value;

        // 3. 21を超えたか、ちょうど21になったかチェック
        if (handValue > 21) {
          currentHand.status = "busted"; // バースト！
        } else if (handValue === 21) {
          currentHand.status = "stand"; // 21なら、もう引けないので自動でスタンド
        }
      } else if (i.customId === "bj_stand") {
        // 1. プレイヤーがスタンドを選んだので、手札の状態を 'stand' に変更
        currentHand.status = "stand";
      } else if (i.customId === "bj_surrender") {
        // 【守りの奥義：サレンダー】
        currentHand.status = "surrender";
        // サレンダーは即座にその手札のプレイを終了する
      } else if (i.customId === "bj_double") {
        // 【攻めの奥義：ダブルダウン】
        const userPoint = await Point.findOne({
          where: { userId },
          transaction: t,
        });
        const additionalBet = currentHand.bet;

        // 1. コインが足りるかチェック
        if (userPoint.coin < additionalBet) {
          await t.rollback(); // トランザクションを中止
          await i.followUp({
            content: "コインが足りないため、ダブルダウンできません。",
            ephemeral: true,
          });
          return; // アクションを中断
        }

        // 2. 追加ベットを行い、カードを1枚だけ引く
        userPoint.coin -= additionalBet;
        currentHand.bet += additionalBet;
        stats.totalBet =
          BigInt(stats.totalBet.toString()) + BigInt(additionalBet);
        currentHand.cards.push(activeGame.deck.pop());
        // ダブルダウンでカードを引いた後、バーストしていないかチェックする
        const handValue = getHandValue(currentHand.cards).value;
        if (handValue > 21) {
          currentHand.status = "busted"; // バースト！
        } else {
          currentHand.status = "doubled"; // バーストしていなければ、スタンドと同じ状態にする
        }

        await userPoint.save({ transaction: t });
      } else if (i.customId === "bj_split") {
        // 【究極の奥義：スプリット】
        const userPoint = await Point.findOne({
          where: { userId },
          transaction: t,
        });
        const additionalBet = currentHand.bet;
        // 0.手札の数が規定を超えてないかチェック
        if (activeGame.playerHands.length >= bjConfig.rules.resplit_limit) {
          await t.rollback();
          await i.followUp({
            content: "これ以上スプリットできません。",
            ephemeral: true,
          });
          return;
        }
        // 1. コインが足りるかチェック
        if (userPoint.coin < additionalBet) {
          await t.rollback();
          await i.followUp({
            content: "コインが足りないため、スプリットできません。",
            ephemeral: true,
          });
          return;
        }

        // 2. 手札を2つに分割する
        userPoint.coin -= additionalBet;
        stats.totalBet =
          BigInt(stats.totalBet.toString()) + BigInt(additionalBet);
        const cardToMove = currentHand.cards.pop();
        const newHand = {
          cards: [cardToMove],
          bet: additionalBet,
          status: "playing",
          isSplitHand: true, //スプリットしたものはBJにならない
        };
        currentHand.isSplitHand = true;

        // 3. それぞれの手札に新しいカードを1枚ずつ配る
        currentHand.cards.push(activeGame.deck.pop());
        newHand.cards.push(activeGame.deck.pop());

        // 4. 新しい手札を、現在の手札のすぐ後ろに追加する
        activeGame.playerHands.splice(
          activeGame.currentHandIndex + 1,
          0,
          newHand
        );

        // 5. エーススプリットの特別ルール
        if (
          currentHand.cards[0].slice(1) === "A" &&
          !bjConfig.rules.hit_split_aces
        ) {
          currentHand.status = "stand";
          newHand.status = "stand";
        }

        await userPoint.save({ transaction: t });
      }

      // ===================================
      // ▼▼▼ ゲームのターン進行判定 ▼▼▼
      // ===================================
      let nextAction = "continue_player_turn"; // 次のアクションの初期値

      // 現在の手札のプレイが終わったか？ (スタンドした or バーストした)
      if (currentHand.status !== "playing") {
        // 次の手札（スプリットした場合）があるかチェック
        if (activeGame.currentHandIndex < activeGame.playerHands.length - 1) {
          activeGame.currentHandIndex++; // 次の手札へ
        } else {
          // プレイヤーの全手札のプレイが完了！ディーラーのターンへ移行
          nextAction = "dealer_turn";
        }
      }

      // ===================================
      // ▼▼▼ 画面の更新とDBへの保存 ▼▼▼
      // ===================================
      if (nextAction === "dealer_turn") {
        // ディーラーのターンと、最終的な勝敗判定を行う (これは次のステップ！)
        collector.stop(); // プレイヤーのアクション受付は終了

        // ★★★ ここに、最終結果を計算して表示する関数呼び出しが入ります ★★★
        await handleDealerTurnAndSettle(i, stats, gameData, bjConfig, t); // ← t を渡すのを忘れずに！
      } else {
        // まだプレイヤーのターンが続く（次の手札へ移る、など）
        stats.gameData = gameData; // 変更をセット
        stats.changed("gameData", true); //jsonの変更を通知
        await stats.save({ transaction: t });
        await t.commit(); // ここで一旦DBに保存

        // 画面を再描画
        const embed = renderGameEmbed(activeGame, interaction.user, bjConfig);
        const newCurrentHand =
          activeGame.playerHands[activeGame.currentHandIndex];
        const buttons = createActionButtons(
          newCurrentHand,
          bjConfig.rules,
          activeGame.playerHands.length
        );
        await i.editReply({ embeds: [embed], components: [buttons] });
      }
    } catch (error) {
      await t.rollback();
      console.error("BJプレイ中エラー:", error);
      await i.editReply({
        content:
          "ゲームの進行中にエラーが発生しました。ボタンは無効化されます。",
        components: [],
      });
      collector.stop();
    }
  });

  collector.on("end", async (collected, reason) => {
    // タイムアウト以外の理由（collector.stop()）で終了した場合は、何もしない
    if (reason !== "time") {
      return;
    }

    // タイムアウトした場合の処理
    // ボタンを無効化しておく
    message.edit({ components: [] }).catch(() => {});

    // トランザクションを開始して、ディーラーターンと勝敗判定に進む
    const t = await sequelize.transaction();
    try {
      // 最新のゲーム状態をデータベースから取得
      const stats = await CasinoStats.findOne({
        where: { userId, gameName: bjConfig.gameName },
        transaction: t,
      });
      let gameData = stats.gameData;

      // 進行中のゲームがなければ、何もしない
      if (!gameData.active_game) {
        await t.commit();
        return;
      }

      // 全ての手札を強制的に 'stand' にする
      gameData.active_game.playerHands.forEach((hand) => {
        if (hand.status === "playing") {
          hand.status = "stand";
        }
      });

      // ディーラーターンと勝敗判定の関数を呼び出す
      // ★ interactionオブジェクトの代わりに、ユーザー情報などを持つダミーオブジェクトを渡す
      const pseudoInteraction = {
        user: interaction.user,
        channel: interaction.channel,
      };
      await handleDealerTurnAndSettle(
        pseudoInteraction,
        stats,
        gameData,
        bjConfig,
        t
      );
    } catch (error) {
      await t.rollback();
      console.error("BJタイムアウト処理エラー:", error);
      // タイムアウト時のエラーは、ユーザーに通知しなくても良い場合が多い
    }
  });
}

// ==================================================================
//
//                      ブラックジャック用ヘルパー関数
//
// ==================================================================

/** カードの配列を受け取り、その合計点とsoftフラグを返す */
function getHandValue(hand) {
  let value = 0;
  let aceCount = 0;
  for (const card of hand) {
    const rank = card.slice(1);
    if (rank === "A") {
      aceCount++;
      value += 11;
    } else if (["T", "J", "Q", "K"].includes(rank)) {
      value += 10;
    } else {
      value += parseInt(rank, 10);
    }
  }
  while (value > 21 && aceCount > 0) {
    value -= 10;
    aceCount--;
  }
  return { value, soft: aceCount > 0 && value <= 21 };
}

/** 現在のゲーム状態からEmbedを生成する */
function renderGameEmbed(activeGame, user, bjConfig) {
  const embed = new EmbedBuilder()
    .setTitle(bjConfig.displayName)
    .setColor("#11806A");

  let playerField = "";
  activeGame.playerHands.forEach((hand, index) => {
    const handValue = getHandValue(hand.cards);
    const handCards = formatCards(hand.cards);
    const status = hand.status === "playing" ? "▶️" : "";
    playerField += `${status}**手札 ${index + 1}**: ${handCards} \`(${handValue.value})\`\n`;
  });

  embed.addFields({ name: `プレイヤー: ${user.username}`, value: playerField });

  // ディーラーの手札（ゲーム中は1枚隠す）
  const dealerCards = `${formatCards([activeGame.dealerHand[0]])} ???`;
  embed.addFields({ name: "ディーラー", value: dealerCards });

  embed.setFooter({ text: "あなたの番です。アクションを選択してください。" });
  return embed;
}

/** 現在の手札の状態に応じて、表示するボタンを生成する */
function createActionButtons(hand, rules, handCount) {
  // NOTE: ボタンの表示条件は、現状、主要なものに絞って簡略化しています。
  // config.mjs内の'double_on_any_two'や、スプリットした手札かどうかの判定など、
  // 全てのルールを厳密に反映させるには、ここの条件式をより詳細に記述する必要があります。
  // これは、将来のアップデートで、さらに本格的なBJを目指す際の改善点です。
  const row = new ActionRowBuilder();

  // ヒットとスタンドは常に基本
  row.addComponents(
    new ButtonBuilder()
      .setCustomId("bj_hit")
      .setLabel("ヒット")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("bj_stand")
      .setLabel("スタンド")
      .setStyle(ButtonStyle.Danger)
  );

  // ダブルダウンの条件
  if (hand.cards.length === 2) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("bj_double")
        .setLabel("ダブルダウン")
        .setStyle(ButtonStyle.Primary)
    );
  }

  // スプリットの条件 (ペアかどうか)
  if (
    hand.cards.length === 2 &&
    hand.cards[0].slice(1) === hand.cards[1].slice(1) &&
    handCount < rules.resplit_limit
  ) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("bj_split")
        .setLabel("スプリット")
        .setStyle(ButtonStyle.Secondary)
    );
  }

  // サレンダーの条件
  if (hand.cards.length === 2 && rules.late_surrender) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("bj_surrender")
        .setLabel("サレンダー")
        .setStyle(ButtonStyle.Secondary)
    );
  }

  return row;
}

//カードのスートを絵文字化する
function formatCards(cards) {
  const suitMap = { H: "♥️", S: "♠️", D: "♦️", C: "♣️" };
  return cards
    .map((card) => {
      const suit = card.slice(0, 1);
      const rank = card.slice(1);
      return `${suitMap[suit] || ""}${rank}`;
    })
    .join(" ");
}

/** 指定されたデック数で、シャッフル済みの山札を生成する (T=10に変更) */
function createShuffledDeck(deckCount) {
  const suits = ["H", "S", "D", "C"]; // ハート, スペード, ダイヤ, クラブ
  const ranks = [
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "T",
    "J",
    "Q",
    "K",
  ]; // T=10
  let masterDeck = [];
  for (let i = 0; i < deckCount; i++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        masterDeck.push(suit + rank);
      }
    }
  }
  for (let i = masterDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [masterDeck[i], masterDeck[j]] = [masterDeck[j], masterDeck[i]];
  }
  return masterDeck;
}

async function handleDealerTurnAndSettle(
  interaction,
  stats,
  gameData,
  bjConfig,
  transaction
) {
  const userId = interaction.user.id;
  const activeGame = gameData.active_game;
  const t = transaction; // トランザクションを引き継ぐ

  try {
    const userPoint = await Point.findOne({
      where: { userId },
      transaction: t,
    });

    // ===================================
    // ▼▼▼ ディーラーのターン ▼▼▼
    // ===================================
    let dealerHand = activeGame.dealerHand;
    let dealerValue = getHandValue(dealerHand).value;

    // プレイヤーが全員バーストしていなければ、ディーラーはカードを引く
    const isAllPlayerBusted = activeGame.playerHands.every(
      (hand) => hand.status === "busted"
    );

    if (!isAllPlayerBusted) {
      // ディーラールールに従って、17以上になるまでヒットし続ける
      while (
        dealerValue < 17 ||
        (dealerValue === 17 &&
          getHandValue(dealerHand).soft &&
          !bjConfig.rules.dealer_stands_on_soft_17)
      ) {
        dealerHand.push(activeGame.deck.pop());
        dealerValue = getHandValue(dealerHand).value;
      }
    }

    // ===================================
    // ▼▼▼ 勝敗判定と配当計算 ▼▼▼
    // ===================================
    let totalPayout = 0;
    let finalPlayerHands = [];

    // ▼▼▼ 先にディーラーがBJかどうかを判定しておく ▼▼▼
    const dealerHasBJ =
      getHandValue(dealerHand).value === 21 && dealerHand.length === 2;

    for (const playerHand of activeGame.playerHands) {
      const handValue = getHandValue(playerHand.cards).value;
      const playerHasBJ =
        handValue === 21 &&
        playerHand.cards.length === 2 &&
        !playerHand.isSplitHand;
      let payout = 0;
      let resultText = "";
      if (playerHasBJ && dealerHasBJ) {
        payout = playerHand.bet;
        resultText = "プッシュ (両者BJ)";
      } else if (playerHasBJ) {
        payout = playerHand.bet * (1 + bjConfig.rules.blackjack_payout);
        resultText = "ブラックジャック！";
      } else if (dealerHasBJ) {
        payout = 0;
        resultText = "負け (ディーラーBJ)";
      } else if (playerHand.status === "surrender") {
        payout = playerHand.bet * 0.5;
        resultText = "サレンダー";
      } else if (playerHand.status === "busted") {
        payout = 0;
        resultText = "バースト負け";
      } else if (dealerValue > 21) {
        payout = playerHand.bet * 2; // ダブルダウンやBJの配当は別途計算
        resultText = "勝ち (ディーラーバースト)";
      } else if (handValue > dealerValue) {
        payout = playerHand.bet * 2;
        resultText = "勝ち";
      } else if (handValue < dealerValue) {
        payout = 0;
        resultText = "負け";
      } else {
        payout = playerHand.bet; // プッシュ
        resultText = "プッシュ (引き分け)";
      }

      totalPayout += payout;
      finalPlayerHands.push({
        cards: playerHand.cards,
        result: resultText,
        payout: payout,
      });
    }

    // ===================================
    // ▼▼▼ BJボーナス判定とメッセージ生成 ▼▼▼
    // ===================================
    let bonusMessage = "";
    const persistentData = stats.gameData || {};
    const lastBJInfo = persistentData.last_bj_info || {};

    // プレイヤーのハンドが1つだけで、かつそれがBJだったか判定
    const isSingleHandAndPlayerHasBJ =
      activeGame.playerHands.length === 1 &&
      getHandValue(activeGame.playerHands[0].cards).value === 21 &&
      activeGame.playerHands[0].cards.length === 2;

    if (isSingleHandAndPlayerHasBJ) {
      // スプリットしてない時のみ
      if (
        lastBJInfo.eligible &&
        activeGame.playerHands[0].bet === lastBJInfo.betAmount
      ) {
        // ★★★ 2連BJ達成！ ★★★
        const bonusPayout =
          activeGame.playerHands[0].bet * bjConfig.rules.bonus_payout;
        totalPayout += bonusPayout;
        bonusMessage = `\n\n「2連続でブラックジャックとは恐れいるにゃ…マリアは約束は守るにゃ、もってけドロボーにゃ！」\n+${bonusPayout}コイン！`;
        delete persistentData.last_bj_info;
      } else {
        // ★★★ 初回BJ！ ★★★
        bonusMessage = `\n\n「へえ、運がいいのにゃあ。でももう一回それができるかにゃあ？ できたらご褒美にゃよ\n ……だからって掛け金変えたらダメだからにゃ？」`;
        persistentData.last_bj_info = {
          eligible: true,
          betAmount: activeGame.playerHands[0].bet,
        };
      }
    } else {
      delete persistentData.last_bj_info;
    }

    // ===================================
    // ▼▼▼ 最終的なDB更新と結果表示 ▼▼▼
    // ===================================
    userPoint.coin += totalPayout;
    stats.gamesPlayed = BigInt(stats.gamesPlayed.toString()) + 1n;
    stats.totalWin =
      BigInt(stats.totalWin.toString()) + BigInt(Math.round(totalPayout));

    // active_game を消去し、永続データだけを残す
    delete persistentData.active_game;
    stats.gameData = persistentData;
    stats.changed("gameData", true);
    await userPoint.save({ transaction: t });
    await stats.save({ transaction: t });
    // Discordへの返信処理 "より前" に、DBへの変更を確定させる！
    await t.commit(); // ここで全ての変更を確定！
    // --- ここからはトランザクションの外 ---
    // 最終結果のEmbedを生成
    const finalEmbed = new EmbedBuilder()
      .setTitle("決着！")
      .setColor(
        totalPayout > activeGame.playerHands.reduce((acc, h) => acc + h.bet, 0)
          ? "#57F287"
          : "#ED4245"
      );

    let playerField = "";
    finalPlayerHands.forEach((hand, index) => {
      playerField += `**手札 ${index + 1}**: ${formatCards(hand.cards)} \`(${getHandValue(hand.cards).value})\`\n**結果**: ${hand.result} (+${hand.payout}コイン)\n`;
    });
    finalEmbed.addFields({
      name: `プレイヤー: ${interaction.user.username}`,
      value: playerField,
    });
    finalEmbed.addFields({
      name: "ディーラー",
      value: `${formatCards(dealerHand)} \`(${getHandValue(dealerHand).value})\``,
    });
    if (bonusMessage) {
      finalEmbed.setDescription(bonusMessage);
    }
    finalEmbed.setFooter({ text: `所持コイン: ${userPoint.coin}` });
    // ▼▼▼ Discordへの返信処理だけを、独立した try-catch で囲む ▼▼▼
    try {
      if (interaction.editReply) {
        await interaction.editReply({ embeds: [finalEmbed], components: [] });
      } else {
        await interaction.channel.send({ embeds: [finalEmbed] });
      }
    } catch (replyError) {
      console.error("BJ決着後の返信でエラー:", replyError);
      // DBは正常に更新されているので、ここではエラーをログに出すだけで握りつぶす。
      // フォールバックとして、新しいメッセージで結果を通知する試み。
      await interaction.channel
        .send({
          content: `<@${userId}>さんのブラックジャックのゲームが完了しました。`,
          embeds: [finalEmbed],
        })
        .catch((finalErr) =>
          console.error("BJ決着後のフォールバック送信にも失敗:", finalErr)
        );
    }
  } catch (dbError) {
    // ▼▼▼ このcatchブロックは、DB操作が失敗した場合にのみ実行される ▼▼▼
    console.error("BJ決着処理中のDBエラー:", dbError);
    // トランザクションがまだ終わっていなければロールバックを試みる
    if (t && !t.finished) {
      await t.rollback();
    }

    // ユーザーにDBエラーを通知
    try {
      await interaction.editReply({
        content: "ゲームの決着処理中にデータベースエラーが発生しました。",
        components: [],
      });
    } catch (replyError) {
      await interaction.channel.send({
        content: `<@${userId}> ゲームの決着処理中にデータベースエラーが発生しました。`,
      });
    }
  }
}
