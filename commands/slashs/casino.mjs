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
import {
  Point,
  CasinoStats,
  sequelize,
  IdleGame,
} from "../../models/database.mjs";
import { getPizzaBonusMultiplier } from "../../utils/idle-game-calculator.mjs";
import config from "../../config.mjs";
import { getSupabaseClient } from "../../utils/supabaseClient.mjs";
import {
  unlockAchievements,
  unlockHiddenAchievements,
} from "../../utils/achievements.mjs";

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
    {
      name: "roulette",
      description: "ヨーロピアンスタイルのルーレットで遊びます。",
      notes: "ニョワコインやニョボチップを賭けて遊べます。",
    },
    {
      name: "stats",
      description: "カジノの個人成績を確認します。",
      notes: "他の人の成績を見る場合は、ユーザーを指定します。",
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
          // ▼▼▼ 名前をより明確に ▼▼▼
          .setName("bet_per_line")
          .setDescription("1ラインあたりの賭けコイン枚数(1-20)")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(20)
      )
      // ▼▼▼ ライン数を指定するオプションを追加 ▼▼▼
      .addIntegerOption((option) =>
        option
          .setName("lines")
          .setDescription("賭けるライン数(1-5)")
          .setRequired(false) // 必須ではなく、未指定の場合は1として扱う
          .setMinValue(1)
          .setMaxValue(5)
      )
  )
  //スロット２号機
  .addSubcommand((subcommand) =>
    subcommand
      .setName("slots_easy")
      .setDescription("【2号機】当たりやすい安全設計のマシン")
      .addIntegerOption((option) =>
        option
          // ▼▼▼ 名前をより明確に ▼▼▼
          .setName("bet_per_line")
          .setDescription("1ラインあたりの賭けコイン枚数(1-20)")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(20)
      )
      // ▼▼▼ ライン数を指定するオプションを追加 ▼▼▼
      .addIntegerOption((option) =>
        option
          .setName("lines")
          .setDescription("賭けるライン数(1-5)")
          .setRequired(false) // 必須ではなく、未指定の場合は1として扱う
          .setMinValue(1)
          .setMaxValue(5)
      )
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
  )
  //ルーレット
  .addSubcommand((subcommand) =>
    subcommand
      .setName("roulette")
      .setDescription("ヨーロピアンスタイルのルーレットで遊びます。")
      .addStringOption((option) =>
        option
          .setName("bet")
          .setDescription("賭ける場所を選択してください。")
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addIntegerOption(
        (option) =>
          option
            .setName("coin")
            .setDescription("ニョワコインを賭けます（最大100枚）")
            .setMinValue(1)
            .setMaxValue(100) // ニョワコインの最大ベット額
      )
      .addIntegerOption(
        (option) =>
          option
            .setName("legacy_pizza")
            .setDescription("ニョボチップを賭けます（最大10,000枚）")
            .setMinValue(1)
            .setMaxValue(10000) // ニョボチップの最大ベット額
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("stats")
      .setDescription("カジノの個人成績を確認します。")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("他の人の成績を見る場合は、ユーザーを指定します。")
      )
  );
// --- オートコンプリート処理 ---
export async function autocomplete(interaction) {
  const focusedOption = interaction.options.getFocused(true);

  if (focusedOption.name === "bet") {
    const userInput = focusedOption.value.toLowerCase();

    const allBets = Object.entries(config.casino.roulette.bets).map(
      ([key, value]) => ({
        name: value.name,
        value: key,
        type: value.type, // 並び替え用にtypeを保持
      })
    );

    // ユーザーの入力がある場合は、通常通りフィルター
    if (userInput) {
      const filtered = allBets.filter(
        (choice) =>
          choice.name.toLowerCase().includes(userInput) ||
          choice.value.toLowerCase().includes(userInput)
      );
      await interaction.respond(filtered.slice(0, 25));
    } else {
      // ▼▼▼ 入力が空の場合のロジック ▼▼▼
      const outsideBets = allBets.filter((b) => b.type !== "number");
      const insideBets = allBets.filter((b) => b.type === "number");

      // アウトサイドベットを先に表示し、残りをインサイドベットで埋める
      const sortedBets = [...outsideBets, ...insideBets];

      await interaction.respond(sortedBets.slice(0, 25));
    }
  }
}
// ==================================================================
// --- コマンド実行部分 ---
export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "slots") {
    await handleSlots(interaction, config.casino.slot);
  } else if (subcommand === "slots_easy") {
    await handleSlots(interaction, config.casino.slot_lowrisk);
  } else if (subcommand === "blackjack") {
    await handleBlackjack(interaction);
  } else if (subcommand === "roulette") {
    await handleRoulette(interaction);
  } else if (subcommand === "stats") {
    await handleStats(interaction);
  }
}
// ==================================================================
//スロット
// ==================================================================
// --- スロットゲームのメインロジック ---
async function handleSlots(interaction, slotConfig) {
  const betPerLine = interaction.options.getInteger("bet_per_line");
  const lines = interaction.options.getInteger("lines") ?? 1; // 指定がなければ1
  const totalBetAmount = betPerLine * lines; // 合計ベット額
  const userId = interaction.user.id;

  // セッション（連続プレイ）ごとの統計
  let sessionPlays = 0;
  let sessionProfit = 0;

  await interaction.deferReply();

  // --- ゲームループ関数 ---
  const gameLoop = async (
    isFirstPlay = true,
    currentEmbed = null,
    interactionContext
  ) => {
    const client = interactionContext.client;
    let isReach = false;
    let embed = currentEmbed;
    if (isFirstPlay) {
      embed = new EmbedBuilder();
      // スロットを初めて回した実績
      if (slotConfig.playAchievementId) {
        await unlockAchievements(client, userId, slotConfig.playAchievementId);
      }
      // 20枚x5ライン賭けの実績
      if (betPerLine === 20 && lines === 5) {
        await unlockAchievements(client, userId, 44);
      }
    }
    const t = await sequelize.transaction();
    try {
      const userPoint = await Point.findOne({
        where: { userId },
        transaction: t,
      });

      if (!userPoint || userPoint.coin < totalBetAmount) {
        const message = isFirstPlay
          ? `${totalBetAmount}コインを払えません！\n現在の所持${config.nyowacoin}: ${userPoint?.coin || 0}枚\n-# /bankでどんぐりやRPをコインに交換できます。`
          : `コインが足りなくなったため、ゲームを終了します。\n-# /bankでどんぐりやRPをコインに交換できます。`;

        // ▼▼▼ ここで、初回かどうかで表示を分岐させる ▼▼▼
        if (isFirstPlay) {
          // --- 初回プレイでコイン不足の場合 ---
          // シンプルなテキストメッセージだけを表示する
          await interactionContext.editReply({
            content: message,
            embeds: [], // Embedは表示しない
            components: [],
          });
        } else {
          // --- 連続プレイ中にコイン不足になった場合 ---
          // 最後の盤面(Embed)を残しつつ、テキストでメッセージを伝える
          embed.setFooter({
            text: `ゲーム終了 | 今回のセッション: ${sessionPlays}プレイ / 損益: ${sessionProfit > 0 ? "+" : ""}${sessionProfit}コイン`,
          });
          await interactionContext.editReply({
            content: message,
            embeds: [embed], // 最後の盤面と損益を表示
            components: [],
          });
        }

        await t.rollback();
        return "end_game";
      }

      // 賭け金を支払う
      userPoint.coin -= totalBetAmount;

      // --- スロットの結果を先に決定 ---
      // ▼▼▼ 3x3のグリッドを生成するロジックに変更 ▼▼▼
      const resultGrid = []; // まずは空の配列を用意

      // 3つのリール（列）をループで処理
      for (let col = 0; col < 3; col++) {
        const reel = slotConfig.reels[col]; // 現在のリール設定を取得
        // 各リールで3つのシンボルを抽選し、それぞれの行に配置
        for (let row = 0; row < 3; row++) {
          const symbol = reel[Math.floor(Math.random() * reel.length)];
          // resultGrid[row] がまだ存在しなければ、空の配列で初期化
          if (!resultGrid[row]) {
            resultGrid[row] = [];
          }
          resultGrid[row][col] = symbol; // [行][列] の位置にシンボルを格納
        }
      }
      /*
        こうすることで、resultGrid は以下の様な形になります
        [
          [ "cherry", "lemon", "grape" ], // 1行目
          [ "grape", "grape", "grape" ], // 2行目 (中央ライン)
          [ "lemon", "cherry", "7"    ]  // 3行目
        ]
      */

      // 結果を表示用に絵文字に変換したグリッドも用意しておくと便利
      const emojiGrid = resultGrid.map((row) =>
        row.map((symbol) => slotConfig.symbols[symbol] || "❓")
      );
      const rotateEmoji = slotConfig.symbols.rotate;

      // ▼▼▼ 5つの有効ラインの定義 ▼▼▼
      // resultGridから、判定対象となる5パターンのラインを配列として取り出す
      const lineDefinitions = [
        // Line 1: 中央ライン
        [resultGrid[1][0], resultGrid[1][1], resultGrid[1][2]],
        // Line 2: 上段ライン
        [resultGrid[0][0], resultGrid[0][1], resultGrid[0][2]],
        // Line 3: 下段ライン
        [resultGrid[2][0], resultGrid[2][1], resultGrid[2][2]],
        // Line 4: 右下がり斜め (＼)
        [resultGrid[0][0], resultGrid[1][1], resultGrid[2][2]],
        // Line 5: 右上がり斜め (／)
        [resultGrid[2][0], resultGrid[1][1], resultGrid[0][2]],
      ];
      // ユーザーが賭けたライン数ぶんだけ、ループして役を判定
      const activeLines = lineDefinitions.slice(0, lines);

      // --- アニメーション ---
      embed
        .setColor("#2f3136")
        .setTitle(`${slotConfig.displayname} $${betPerLine}`)
        .setFields([]) // フィールドをリセット
        .setFooter(null); // フッターをリセット

      const buildDescription = (grid, lines) => {
        // ▼▼▼ 参照先を、共通の config.casino に変更 ▼▼▼
        const displayConfig = config.casino.lines_display;
        if (!displayConfig) {
          // もしコンフィグがなければ、古い表示のままにする
          return grid.map((row) => `> **${row.join(" | ")}**`).join("\n");
        }

        // ライン番号に対応する絵文字を返す、小さなヘルパー
        const getIndicator = (lineIndex) => {
          // lineIndexがベット数より小さい = ベットされているライン
          if (lineIndex < lines) {
            return displayConfig.active[lineIndex];
          } else {
            return displayConfig.inactive[lineIndex];
          }
        };

        const o = displayConfig.order; // orderのショートカット

        // 新しい表示を組み立てる
        const topIndicator = getIndicator(o.line4);
        const bottomIndicator = getIndicator(o.line5);

        const line2 = `${getIndicator(o.line2)} ${grid[0].join("|")}`;
        const line1 = `${getIndicator(o.line1)} ${grid[1].join("|")}`;
        const line3 = `${getIndicator(o.line3)} ${grid[2].join("|")}`;

        // 全てを結合して返す
        return [
          `**${topIndicator}**`,
          `# **${line2}**`,
          `# **${line1}**`,
          `# **${line3}**`,
          `**${bottomIndicator}**`,
        ].join("\n");
      };

      // 1. 全て回転中のグリッドを用意
      const rotatingGrid = [
        [rotateEmoji, rotateEmoji, rotateEmoji],
        [rotateEmoji, rotateEmoji, rotateEmoji],
        [rotateEmoji, rotateEmoji, rotateEmoji],
      ];
      embed.setDescription(buildDescription(rotatingGrid, lines)); // ヘルパー関数を使ってセット
      await interactionContext.editReply({ embeds: [embed], components: [] });
      await sleep(1000);

      // 2. 1番目のリール（左の列）が停止
      // rotatingGrid の左の列を、結果(emojiGrid)の左の列で上書きする
      for (let row = 0; row < 3; row++) {
        rotatingGrid[row][0] = emojiGrid[row][0];
      }
      embed.setDescription(buildDescription(rotatingGrid, lines));
      await interactionContext.editReply({ embeds: [embed] });
      await sleep(1000);

      // 3. 2番目のリール（真ん中の列）が停止
      for (let row = 0; row < 3; row++) {
        rotatingGrid[row][1] = emojiGrid[row][1];
      }

      // ▼▼▼ リーチ判定と最終リールのアニメーション ▼▼▼
      // ▼▼▼【変更点】リーチ判定を、賭けている全ラインを対象にするロジックに書き換え ▼▼▼
      isReach = false; // まずはリーチではない、と仮定する
      const reachSymbols = ["7", "watermelon", "bell"]; // リーチ対象の絵柄

      for (const line of activeLines) {
        // line[0] (1列目) と line[1] (2列目) が同じシンボルで、
        // かつ、それがリーチ対象の絵柄のどれかだったら...
        if (line[0] === line[1] && reachSymbols.includes(line[0])) {
          isReach = true; // リーチ成立！
          break; // 一つでもリーチがあれば演出は確定なので、ループを抜ける
        }
      }

      // isReachがtrueなら5秒、falseなら1秒待つように設定
      const lastReelDelay = isReach ? 5000 : 1000;
      let description = buildDescription(rotatingGrid, lines);

      if (isReach) {
        // isReachがtrueの場合、盤面の下にリーチ演出のテキストを追加
        description += `\n# ${slotConfig.symbols.reach} **リーチ！** ${slotConfig.symbols.reach}`;
        //リーチ実績の解除
        if (slotConfig.reachAchievementId) {
          await unlockAchievements(
            client,
            userId,
            slotConfig.reachAchievementId
          );
        }
      }

      embed.setDescription(description);
      await interactionContext.editReply({ embeds: [embed] });
      await sleep(lastReelDelay); // 設定した時間だけ待つ

      // --- 役の判定とDB更新 ---
      let totalWinAmount = 0; // このスピンでの合計勝利コイン
      const wonPrizes = []; // 当たった役をすべて保存しておく配列

      for (const lineResult of activeLines) {
        // ★★★ 既存のgetSlotPrize関数がそのまま使える！ ★★★
        const prize = getSlotPrize(lineResult, slotConfig);
        if (prize.payout > 0) {
          // 1ラインあたりのベット額 × 役の倍率 を合計勝利コインに加算
          totalWinAmount += betPerLine * prize.payout;
          // 当たった役の情報を配列に保存しておく
          wonPrizes.push(prize);
        }
      }

      // DBのコインを更新
      userPoint.coin += totalWinAmount;

      // DBの統計情報を更新
      const [stats] = await CasinoStats.findOrCreate({
        where: { userId, gameName: slotConfig.gameName },
        transaction: t,
      });
      // プレイ回数はライン数ぶん加算
      stats.gamesPlayed = BigInt(stats.gamesPlayed.toString()) + BigInt(lines);
      // ベット額、勝利額は合計値を加算
      stats.totalBet =
        BigInt(stats.totalBet.toString()) + BigInt(totalBetAmount);
      stats.totalWin =
        BigInt(stats.totalWin.toString()) + BigInt(totalWinAmount);

      // 役ごとの統計も、当たった役すべてを記録する
      if (wonPrizes.length > 0) {
        const currentData = stats.gameData || {};
        for (const prize of wonPrizes) {
          if (prize.id !== "none") {
            const prizeKey = `wins_${prize.id}`;
            currentData[prizeKey] = (currentData[prizeKey] || 0) + 1;
            if (prize.achievementId) {
              await unlockAchievements(client, userId, prize.achievementId);
            }
          }
        }
        stats.gameData = currentData;
        stats.changed("gameData", true);
      }

      await userPoint.save({ transaction: t });
      await stats.save({ transaction: t });
      await t.commit(); // ここでDBへの変更を確定

      //実績i9 「J-A-C-K-P-O-T」
      // totalWinAmount (このスピンでの合計勝利コイン) が10000以上かチェック
      if (totalWinAmount >= 10000) {
        await unlockHiddenAchievements(client, userId, 9);
      }

      // セッション情報を更新
      sessionPlays++; // 統計に加算する回数はライン数だが、セッションのプレイ回数は1固定
      sessionProfit += totalWinAmount - totalBetAmount; // 損益を計算

      // --- 最終結果の表示 ---
      // ▼▼▼ 3つのリールがすべて止まった最終盤面を生成 ▼▼▼
      const finalDescription = buildDescription(emojiGrid, lines);

      // ▼▼▼ 当たった役を分かりやすく表示するためのテキストを生成 ▼▼▼
      let prizeText = "ハズレ...";
      if (wonPrizes.length > 0) {
        // 同じ役が複数当たった場合に「役の名前 x2」のように集計する
        const prizeSummary = wonPrizes.reduce((acc, prize) => {
          acc[prize.name] = (acc[prize.name] || 0) + 1;
          return acc;
        }, {}); // 例: { "チェリーx2": 2, "レモン": 1 }

        // 集計した結果を元に、表示用のテキストを組み立てる
        prizeText = Object.entries(prizeSummary)
          .map(([name, count]) => `${name}${count > 1 ? ` **x${count}**` : ""}`)
          .join("\n"); // 例: "チェリーx2 **x2**\nレモン"
      }

      embed
        // ▼▼▼ 合計勝利コインで色を判定 ▼▼▼
        .setColor(totalWinAmount > 0 ? "#57F287" : "#ED4245")
        // ▼▼▼ 最終盤面を表示 ▼▼▼
        .setDescription(finalDescription)
        .setFields(
          // ▼▼▼ 当たった役のリストを表示 ▼▼▼
          { name: "役", value: prizeText, inline: true },
          {
            name: "配当",
            // ▼▼▼ 合計勝利コインを表示 ▼▼▼
            value: `+${totalWinAmount} ${config.nyowacoin}`,
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
          .setLabel(`${totalBetAmount}コインで更に回す`)
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

      const message = await interactionContext.editReply({
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
          // gameLoopを呼び出すだけ。終了処理はgameLoop自身が責任を持つ。
          await gameLoop(false, embed, i);
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
        // タイムアウトで終了した場合のみボタンを無効化
        if (collected.size === 0) {
          buttons.components.forEach((btn) => btn.setDisabled(true));
          // interactionContextではなく、collectorを生成したmessageオブジェクトで編集する
          message.edit({ components: [buttons] }).catch(() => {});
        }
      });
    } catch (error) {
      console.error("スロット処理中にエラー:", error);
      console.error(`[Casino Error Log] エラー発生時のスロット出目と状況:`, {
        userId: userId,
        betPerLine: betPerLine, // 1ラインあたりのベット
        lines: lines, // ライン数
        isReach: isReach,
        resultGrid: resultGrid, // 最終的な盤面
      });
      await t.rollback();
      // エラー通知の失敗でBotがクラッシュしないよう、さらにtry...catchで囲む
      try {
        await interactionContext.followUp({
          content:
            "エラーが発生したため、処理を中断しました。コインは消費されていません。",
          ephemeral: true,
        });
      } catch (followUpError) {
        console.error(
          "スロットのエラー通知(followUp)に失敗しました:",
          followUpError
        );
        // ここではエラーを握りつぶし、Botの動作を継続させる
      }
    }
  };

  await gameLoop(true, null, interaction); // 最初のゲームを開始
}

/**
 * スロットの結果から役を判定し、役の情報オブジェクトを返します。
 * @param {string[]} result - スロットのリール結果 (例: ["cherry", "cherry", "lemon"])
 * @param {object} slotConfig - 使用するスロットの設定オブジェクト
 * @returns {object} 役の情報オブジェクト。ハズレの場合は { id: "none", name: "ハズレ...", payout: 0 } を返す。
 */
function getSlotPrize(result, slotConfig) {
  // 高配当（payouts配列の上の方）から順にチェック
  for (const prize of slotConfig.payouts) {
    // 3つ揃いのパターンをチェック
    if (prize.pattern) {
      const isMatch = result.every(
        (symbol, index) => symbol === prize.pattern[index]
      );
      if (isMatch) {
        // マッチしたprizeオブジェクト（役の定義そのもの）を返す
        return prize;
      }
    }
    // 左揃えのパターンをチェック (例: チェリーx2)
    else if (prize.leftAlign && prize.symbol) {
      // 役の成立に必要な絵柄が、左から連続で揃っているか確認
      const targetSlice = result.slice(0, prize.leftAlign);
      const isMatch = targetSlice.every((s) => s === prize.symbol);

      if (isMatch) {
        // こちらも同様に、マッチしたprizeオブジェクトを返す
        return prize;
      }
    }
  }
  // どの役にも当てはまらない場合、ハズレを示すオブジェクトを返す
  return { id: "none", name: "ハズレ...", payout: 0 };
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
        await unlockAchievements(interaction.client, userId, 47); // ID:47 21!
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
        await unlockAchievements(interaction.client, userId, 48); // 実績ID:48 42!!!
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
// ==================================================================
// ルーレット
// ==================================================================
async function handleRoulette(interaction) {
  const userId = interaction.user.id;

  // --- 通貨と賭け金の決定 ---
  const coinAmount = interaction.options.getInteger("coin");
  const pizzaAmount = interaction.options.getInteger("legacy_pizza");
  const betKey = interaction.options.getString("bet");

  let currencyKey;
  let amount;

  if (coinAmount) {
    currencyKey = "coin";
    amount = coinAmount;
  } else if (pizzaAmount) {
    currencyKey = "legacy_pizza";
    amount = pizzaAmount;
  } else {
    // どちらも入力されていない場合
    return interaction.reply({
      content:
        "賭ける通貨（`coin`または`legacy_pizza`）と枚数を指定してください。",
      ephemeral: true,
    });
  }

  const currencyInfo = config.casino.currencies[currencyKey];
  const betInfo = config.casino.roulette.bets[betKey];
  const rouletteConfig = config.casino.roulette;

  if (!betInfo) {
    return interaction.reply({
      content: "無効なベットが指定されました。選択肢から選んでください。",
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  const t = await sequelize.transaction();
  try {
    const [userPoint, created] = await Point.findOrCreate({
      where: { userId },
      defaults: { userId },
      transaction: t,
    });

    // 賭け金チェック
    if ((userPoint[currencyKey] || 0) < amount) {
      //null対策で0をデフォルトに
      await t.rollback();
      return interaction.editReply({
        content: `${currencyInfo.displayName}が足りません！\n現在の所持${currencyInfo.emoji}: ${userPoint[currencyKey]}`,
      });
    }

    userPoint[currencyKey] -= amount;

    const winningNumber = Math.floor(Math.random() * 37);
    const winningColor = rouletteConfig.pockets[winningNumber];

    //0に入った実績49
    if (winningNumber === 0) {
      await unlockAchievements(interaction.client, userId, 49); // ID:49 いただきですにゃー♪
    }

    let isWin = false;
    if (winningNumber > 0) {
      switch (betInfo.type) {
        case "color":
          isWin = winningColor === betInfo.value;
          break;
        case "even_odd":
          isWin = (winningNumber % 2 === 0 ? "even" : "odd") === betInfo.value;
          break;
        case "range":
          isWin =
            winningNumber >= betInfo.value.min &&
            winningNumber <= betInfo.value.max;
          break;
        case "column":
          isWin = winningNumber % 3 === betInfo.value;
          break;
      }
    }
    if (betInfo.type === "number") {
      isWin = winningNumber === betInfo.value;
    }

    let payout = 0;
    let winAmount = 0;
    if (isWin) {
      payout = amount * betInfo.payout;
      winAmount = amount + payout;
      userPoint[currencyKey] += winAmount;
    }

    const [stats] = await CasinoStats.findOrCreate({
      where: { userId, gameName: rouletteConfig.gameName },
      transaction: t,
    });
    // 統計の更新
    stats.gamesPlayed = BigInt(stats.gamesPlayed) + 1n;
    //賭ける通貨ごとに記録するので、totalBet, totalWinは使わない
    //stats.totalBet = BigInt(stats.totalBet) + BigInt(amount);
    //stats.totalWin = BigInt(stats.totalWin) + BigInt(winAmount);

    // gameData に通貨ごとの詳細な統計を保存
    const gameData = stats.gameData || {}; // 既存のgameDataを取得、なければ空オブジェクト
    if (!gameData[currencyKey]) {
      // この通貨でのプレイが初めてなら、初期オブジェクトを作成
      gameData[currencyKey] = {
        gamesPlayed: "0",
        totalBet: "0",
        totalWin: "0",
      };
    }
    // BigIntで安全に計算
    gameData[currencyKey].gamesPlayed = (
      BigInt(gameData[currencyKey].gamesPlayed) + 1n
    ).toString();
    gameData[currencyKey].totalBet = (
      BigInt(gameData[currencyKey].totalBet) + BigInt(amount)
    ).toString();
    gameData[currencyKey].totalWin = (
      BigInt(gameData[currencyKey].totalWin) + BigInt(winAmount)
    ).toString();

    // 更新したgameDataをセットし直し、変更をSequelizeに通知
    stats.gameData = gameData;
    stats.changed("gameData", true);

    await userPoint.save({ transaction: t });
    await stats.save({ transaction: t });
    await t.commit();

    const numberEmoji = { red: "🔴", black: "⚫", green: "🟢" };
    const ROULETTE_IMAGE_URL =
      "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/European_roulette.svg/960px-European_roulette.svg.png";
    const resultEmbed = new EmbedBuilder()
      .setTitle(`**${rouletteConfig.displayName}**`)
      .setDescription(
        `ベット: **${amount}** ${currencyInfo.emoji} on **${betInfo.name}**`
      )
      .setTimestamp();

    await interaction.editReply({ content: "ルーレットを回しています... 🤞" });
    await sleep(2000);

    if (isWin) {
      resultEmbed
        .setColor("#57F287")
        .setTitle(`🎉 **当たり！** 🎉`)
        .addFields(
          {
            name: "結果",
            value: `${numberEmoji[winningColor]} **${winningNumber}**`,
            inline: true,
          },
          {
            name: "配当",
            value: `+${winAmount.toLocaleString()} ${currencyInfo.emoji}`,
            inline: true,
          },
          {
            name: `所持${currencyInfo.displayName}`,
            value: `${userPoint[currencyKey].toLocaleString()} ${currencyInfo.emoji}`,
            inline: true,
          }
        );
    } else {
      resultEmbed
        .setColor("#ED4245")
        .setTitle(`**ハズレ...**`)
        .addFields(
          {
            name: "結果",
            value: `${numberEmoji[winningColor]} **${winningNumber}**`,
            inline: true,
          },
          {
            name: "損失",
            value: `-${amount.toLocaleString()} ${currencyInfo.emoji}`,
            inline: true,
          },
          {
            name: `所持${currencyInfo.displayName}`,
            value: `${userPoint[currencyKey].toLocaleString()} ${currencyInfo.emoji}`,
            inline: true,
          }
        );
    }
    // ルーレットの画像を添付
    resultEmbed.setImage(ROULETTE_IMAGE_URL);

    await interaction.editReply({ content: "", embeds: [resultEmbed] });
  } catch (error) {
    if (!t.finished) await t.rollback();
    console.error("ルーレット処理中にエラー:", error);
    await interaction.editReply({
      content:
        "エラーが発生したため、処理を中断しました。通貨は消費されていません。",
    });
  }
}

// ==================================================================
// 統計表示
// ==================================================================
async function handleStats(interaction) {
  // 表示対象のユーザーを決定 (オプションがなければ自分)
  const targetUser = interaction.options.getUser("user") || interaction.user;
  const userId = targetUser.id;

  await interaction.deferReply();

  try {
    // 1. ユーザーの全てのカジノ統計を一度に取得する
    const allStats = await CasinoStats.findAll({ where: { userId } });

    // 2. プレイ記録が全くない場合の処理
    if (allStats.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle(`**${targetUser.username}** さんのカジノ成績`)
        .setColor("#f2c75c")
        .setDescription("まだカジノで遊んだ記録がないようです！");
      return interaction.editReply({ embeds: [embed] });
    }

    // 3. 扱いやすいように、gameNameをキーにしたオブジェクトに変換する
    const stats = allStats.reduce((acc, current) => {
      acc[current.gameName] = current;
      return acc;
    }, {});

    // 4. Embedを組み立てる
    const embed = new EmbedBuilder()
      .setTitle(`**${targetUser.username}** さんのカジノ成績`)
      .setColor("#f2c75c")
      .setTimestamp();

    // --- ブラックジャックの成績 (データがあれば追加) ---
    if (stats.blackjack) {
      const bj = stats.blackjack;
      const netProfit = BigInt(bj.totalWin) - BigInt(bj.totalBet);
      const sign = netProfit >= 0 ? "+" : "";
      embed.addFields({
        name: "🃏 ブラックジャック",
        value: `**プレイ回数:** ${bj.gamesPlayed.toLocaleString()}回\n**総収支:** ${sign}${netProfit.toLocaleString()}コイン`,
      });
    }

    // --- スロット1号機の成績 (データがあれば追加) ---
    if (stats.slots) {
      const slot = stats.slots;
      const netProfit = BigInt(slot.totalWin) - BigInt(slot.totalBet);
      const sign = netProfit >= 0 ? "+" : "";
      let slotDetails = "";
      for (const prize of config.casino.slot.payouts) {
        const prizeCount = slot.gameData[`wins_${prize.id}`] || 0;
        if (prizeCount > 0) {
          slotDetails += `${prize.display}: ${prizeCount}回\n`;
        }
      }
      embed.addFields({
        name: `🎰 ${config.casino.slot.displayname}`,
        value: `**プレイ記録:** ${slot.gamesPlayed.toLocaleString()}ライン  **総収支:** ${sign}${netProfit.toLocaleString()}コイン\n${slotDetails}`,
      });
    }
    // --- スロット2号機の成績 (データがあれば追加) ---
    if (stats.slots_easy) {
      const slot_easy = stats.slots_easy;
      const netProfit = BigInt(slot_easy.totalWin) - BigInt(slot_easy.totalBet);
      const sign = netProfit >= 0 ? "+" : "";
      let slotEasyDetails = "";
      for (const prize of config.casino.slot_lowrisk.payouts) {
        const prizeCount = slot_easy.gameData[`wins_${prize.id}`] || 0;
        if (prizeCount > 0) {
          slotEasyDetails += `${prize.display}: ${prizeCount}回\n`;
        }
      }
      embed.addFields({
        name: `🎰 ${config.casino.slot_lowrisk.displayname}`,
        value: `**プレイ記録:** ${slot_easy.gamesPlayed.toLocaleString()}ライン  **総収支:** ${sign}${netProfit.toLocaleString()}コイン\n${slotEasyDetails}`,
      });
    }

    // --- ルーレットの成績 (データがあれば追加) ---
    if (stats.roulette) {
      const roulette = stats.roulette;
      let rouletteDetails = `**総プレイ回数:** ${roulette.gamesPlayed.toLocaleString()}回\n\n`;

      // gameData内の通貨ごとにループ
      for (const currencyKey in roulette.gameData) {
        const currencyStats = roulette.gameData[currencyKey];
        const currencyInfo = config.casino.currencies[currencyKey];
        const netProfit =
          BigInt(currencyStats.totalWin) - BigInt(currencyStats.totalBet);
        const sign = netProfit >= 0 ? "+" : "";

        rouletteDetails += `**${currencyInfo.displayName} ${currencyInfo.emoji}**\n- **プレイ回数:** ${BigInt(currencyStats.gamesPlayed).toLocaleString()}回\n- **総収支:** ${sign}${netProfit.toLocaleString()}\n`;
      }
      embed.addFields({
        name: "🎡 ルーレット",
        value: rouletteDetails,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("統計表示でエラー:", error);
    await interaction.editReply("成績の取得中にエラーが発生しました。");
  }
}
