// commands\utils\domino.mjs
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { DominoLog, CurrentDomino, sequelize } from "../../models/database.mjs"; // あなたのデータベース設定からDominoLogとCurrentDominoモデルをインポート
import config from "../../config.mjs";
import { safeDelete } from "../../utils/messageutil.mjs";

export const data = new SlashCommandBuilder()
  .setName("domino")
  .setNameLocalizations({
    ja: "ドミノ履歴",
  })
  .setDescription("ドミノを崩した人の履歴を見れます")
  .addIntegerOption((option) =>
    option
      .setName("index")
      .setNameLocalizations({
        ja: "回数",
      })
      .setDescription("指定回数から10回分の履歴を閲覧できます（-1で最新10回）")
      .setMinValue(-1)
  );

export async function execute(interaction) {
  const indexOption = interaction.options.getInteger("index") || null;

  if (indexOption === null) {
    // 統計データの取得 (DominoLog から集計)
    const totalDominoCount = (await DominoLog.sum("totalCount")) || 0;
    const totalPlayerCount = (await DominoLog.sum("playerCount")) || 0;
    const zeroCount = await DominoLog.count({ where: { totalCount: 0 } });

    // 最高記録の取得 (DominoLog から取得)
    const highestRecordLog = await DominoLog.findOne({
      order: [["totalCount", "DESC"]],
    });
    const highestRecord = highestRecordLog?.totalCount || 0;
    const highestRecordHolderLog = await DominoLog.findOne({
      where: { totalCount: highestRecord },
      order: [["createdAt", "DESC"]], // 最新の記録保持者を取得
    });
    const highestRecordHolder = highestRecordHolderLog?.loserName || "不明";

    const currentDomino = await CurrentDomino.findOne();
    if (!currentDomino) {
      await CurrentDomino.create({
        attemptNumber: 1,
        totalCount: 0,
        totalPlayers: 0,
      });
    }
    //ドミノの枚数と並べた回数の合計
    // 直近5回の履歴 (DominoLog から取得)
    const recentHistories = await DominoLog.findAll({
      order: [["attemptNumber", "DESC"]],
      limit: 5,
    });

    // 崩した人ランキング (DominoLog から集計)
    const loserCounts = await DominoLog.findAll({
      attributes: [
        "loserName",
        [sequelize.fn("COUNT", sequelize.col("loserName")), "count"],
      ],
      group: ["loserName"],
      order: [[sequelize.literal("count"), "DESC"]],
      limit: 10,
      raw: true,
    });

    let response = `現在のドミノ:第${currentDomino?.attemptNumber || 1}回 ${
      currentDomino?.totalPlayers || 0
    }人 ${
      currentDomino?.totalCount || 0
    }枚\n-# 最高記録：${highestRecord}枚 崩した人:${escapeDiscordText(
      highestRecordHolder
    )}\n-# 総ドミノ:${new Intl.NumberFormat("ja-JP").format(
      totalDominoCount
    )}枚　総人数:${new Intl.NumberFormat("ja-JP").format(
      totalPlayerCount
    )}人　虚無崩し(0枚):${zeroCount}回\n`;

    response += "★直近5回のドミノゲームの履歴★\n";
    recentHistories.forEach((log, index) => {
      response += `-# 第${log.attemptNumber}回:${log.totalCount}枚 ${
        log.playerCount
      }人 崩した人:${escapeDiscordText(log.loserName)}\n`;
    });

    response += "★崩した人上位10位★\n";
    loserCounts.forEach((loser, index) => {
      response += `-# ${index + 1}位: ${escapeDiscordText(loser.loserName)} (${
        loser.count
      }回)\n`;
    });

    await interaction.reply(response);
  } else {
    // 指定されたインデックスからの履歴表示 (DominoLog から取得)
    const limit = 10;
    const offset =
      indexOption === -1
        ? Math.max(0, (await DominoLog.count()) - limit)
        : Math.max(0, indexOption - 1);

    const histories = await DominoLog.findAll({
      order: [["attemptNumber", "ASC"]],
      offset: offset,
      limit: limit,
    });

    let response = `★第${offset + 1}回からのドミノゲームの履歴★\n`;
    histories.forEach((log, index) => {
      response += `-# 第${log.attemptNumber}回:${log.totalCount}枚 ${
        log.playerCount
      }人 崩した人:${escapeDiscordText(log.loserName)}\n`;
    });

    await interaction.reply(response);
  }
}

//メッセージ、クライアント
export async function dominoeffect(message, client, id, username, dpname) {
  const randomNum = Math.floor(Math.random() * 100);
  // 十の桁と一の桁を取得
  const tens = Math.floor(randomNum / 10); // 十の桁
  const ones = randomNum % 10; // 一の桁
  // サイコロのリアクションを取得
  const redResult = config.reddice[tens];
  const blueResult = config.bluedice[ones];
  await message.react(redResult);
  await message.react(blueResult);
  //ログ送信チャンネルを選択
  const dominochannel = client.channels.cache.get(config.dominoch);

  const currentDomino = await CurrentDomino.findOne();
  if (!currentDomino) {
    await CurrentDomino.create({
      attemptNumber: 1,
      totalCount: 0,
      totalPlayers: 0,
    });
  }
  if (randomNum === 0) {
    //ガシャーン！
    const rarity = 1 / 0.99 ** currentDomino.totalPlayers;
    const fixrarity = rarity.toFixed(2);
    await message.react("💥");
    await dominochannel.send({
      flags: [4096],
      content: `# 100　<@${id}>は${currentDomino.totalPlayers}人が並べた${
        currentDomino.totalCount
      }枚のドミノを崩してしまいました！\nこれは${fixrarity}回に1回しか見られないドミノだったようです。\n${
        currentDomino.attemptNumber
      }回目の開催は終わり、${escapeDiscordText(username)}の名が刻まれました。`,
    });

    // 新しいドミノの履歴を DominoLog に保存
    try {
      /* // デバッグログ開始 バグ解消のためコメントアウト
    console.log("Creating DominoLog with:");
    console.log(
      "  attemptNumber:",
      currentDomino.attemptNumber,
      typeof currentDomino.attemptNumber
    );
    console.log(
      "  totalCount:",
      currentDomino.totalCount,
      typeof currentDomino.totalCount
    );
    console.log(
      "  playerCount:",
      currentDomino.totalPlayers,
      typeof currentDomino.totalPlayers
    );
    console.log("  loserName:", username, typeof username);
    // デバッグログ終了 */

      await DominoLog.create({
        attemptNumber: currentDomino.attemptNumber,
        totalCount: currentDomino.totalCount,
        playerCount: currentDomino.totalPlayers,
        loserName: username,
      });

      console.log("DominoLog created successfully.");
    } catch (error) {
      console.error("Error creating DominoLog!");
      //console.error("Values being used:");
      /* // デバッグログ開始
    console.error(
      "  attemptNumber:",
      currentDomino.attemptNumber,
      typeof currentDomino.attemptNumber
    );
    console.error(
      "  totalCount:",
      currentDomino.totalCount,
      typeof currentDomino.totalCount
    );
    console.error(
      "  playerCount:",
      currentDomino.totalPlayers,
      typeof currentDomino.totalPlayers
    );
    console.error("  loserName:", username, typeof username);
    console.error("Error details:", error);
    if (error.errors) {
      // Sequelize Validation Error の場合
      error.errors.forEach((err) => {
        console.error("  Validation error:", err.message, err.path, err.type);
      });
    }
    // デバッグログ終了 */
    }

    if (currentDomino.totalCount === 0) {
      await dominochannel.send({
        flags: [4096],
        content: `# __★★【特別賞】0枚で終わった回数：${await DominoLog.count({
          where: { totalCount: 0 },
        })}回目__`,
      });
    }
    // 最高記録の更新通知 (DominoLog から取得)
    const currentHighestRecordLog = await DominoLog.findOne({
      order: [["totalCount", "DESC"]],
    });
    if (
      currentHighestRecordLog &&
      currentDomino.totalCount > currentHighestRecordLog.totalCount
    ) {
      await dominochannel.send({
        flags: [4096],
        content: `# __★★【新記録】${currentDomino.totalCount}枚★★__`,
      });
    }

    await CurrentDomino.update(
      {
        attemptNumber: currentDomino.attemptNumber + 1,
        totalCount: 0,
        totalPlayers: 0,
      },
      {
        where: {},
      }
    );
    const replyMessage = await message.reply({
      flags: [4096],
      content: `# ガッシャーン！`,
    });
    setTimeout(() => {
      safeDelete(replyMessage); 
    }, 5000);
  } else {
    //セーフ
    const dpplayer = String(currentDomino.totalPlayers + 1).padStart(4, "0");
    //ドミノを並べたログここから
    //共通部分手前
    let uniqueMessage = `Take${dpplayer}:`;
    // config.mjs から対応するメッセージを取得
    const messageFunc =
      config.dominoMessages[randomNum] || config.dominoMessages.default;
    uniqueMessage += messageFunc(dpname, randomNum);
    // 共通部分後ろ
    uniqueMessage += ` 現在:${currentDomino.totalCount + randomNum}枚`;

    // 10000枚達成した場合に画像を添付
    if (
      currentDomino.totalCount < 10000 &&
      currentDomino.totalCount + randomNum >= 10000
    ) {
      const celebrationImageURL =
        config.domino10000Images[
          Math.floor(Math.random() * config.domino10000Images.length)
        ];

      const messageContent = `${uniqueMessage}\n${celebrationImageURL}`; // 本文に URL を含める

      await dominochannel.send({ content: messageContent, flags: [4096] });

      /*
    if (
      currentDomino.totalCount < 10000 &&
      currentDomino.totalCount + randomNum >= 10000
    ) {
      const celebrationImage =
        config.domino10000Images[
          Math.floor(Math.random() * config.domino10000Images.length)
        ];

      // メッセージ送信時に画像を添付
      await dominochannel.send({
        flags: [4096],
        content: uniqueMessage,
        files: [celebrationImage], // 画像URLを添付ファイルとして送信
      });*/
    } else {
      // 10000枚未満の場合は通常メッセージを送信
      await dominochannel.send({
        flags: [4096],
        content: uniqueMessage,
      });
    }
    await CurrentDomino.update(
      {
        totalCount: currentDomino.totalCount + randomNum,
        totalPlayers: currentDomino.totalPlayers + 1,
      },
      {
        where: {},
      }
    );
    //5秒後に消える奴
    if (message.channel.id !== config.dominoch) {
      const replyMessage = await message.reply({
        flags: [4096],
        content: `${randomNum}ドミドミ…Take${currentDomino.totalPlayers + 1}:${
          currentDomino.totalCount + randomNum
        }枚`,
      });
      setTimeout(() => {
        safeDelete(replyMessage);
      }, 5000);
    }
  }
}

// エスケープ処理のサブルーチン（例 hoge_fuga_がhogefuga(fugaが斜体)にならないように
function escapeDiscordText(text) {
  return text.replace(/([_*`])/g, "\\$1"); // 特殊文字をエスケープ
}
