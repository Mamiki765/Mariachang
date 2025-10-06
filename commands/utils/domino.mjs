// commands\utils\domino.mjs
import { SlashCommandBuilder, EmbedBuilder, ChannelType } from "discord.js";
import { DominoLog, CurrentDomino, sequelize } from "../../models/database.mjs"; // あなたのデータベース設定からDominoLogとCurrentDominoモデルをインポート
import config from "../../config.mjs";
import { safeDelete } from "../../utils/messageutil.mjs";
import {
  unlockAchievements,
  updateAchievementProgress,
  unlockHiddenAchievements,
} from "../../utils/achievements.mjs";

export const help = {
  category: "slash",
  description: "ドミノのログを見る",
  notes: "統計情報や、何回目に誰が何枚倒したなどの情報も詳しく見れます。",
};

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
    // --- 従来の統計データ取得（ここは変更なし） ---
    const totalDominoCount = (await DominoLog.sum("totalCount")) || 0;
    const totalPlayerCount = (await DominoLog.sum("playerCount")) || 0;
    const zeroCount = await DominoLog.count({ where: { totalCount: 0 } });
    const highestRecordLog = await DominoLog.findOne({
      order: [["totalCount", "DESC"]],
    });
    const highestRecord = highestRecordLog?.totalCount || 0;
    const highestRecordHolderLog = await DominoLog.findOne({
      where: { totalCount: highestRecord },
      order: [["createdAt", "DESC"]],
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
    const recentHistories = await DominoLog.findAll({
      order: [["attemptNumber", "DESC"]],
      limit: 5,
    });
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

    // --- 統計情報のメッセージ構築（ここもほぼ同じ） ---
    let response = `現在のドミノ:第${currentDomino?.attemptNumber || 1}回 ${currentDomino?.totalPlayers || 0}人 ${currentDomino?.totalCount || 0}枚\n-# 最高記録：${highestRecord}枚 崩した人:${escapeDiscordText(highestRecordHolder)}\n-# 総ドミノ:${new Intl.NumberFormat("ja-JP").format(totalDominoCount)}枚　総人数:${new Intl.NumberFormat("ja-JP").format(totalPlayerCount)}人　虚無崩し(0枚):${zeroCount}回\n`;
    response += "★直近5回のドミノゲームの履歴★\n";
    recentHistories.forEach((log) => {
      response += `-# 第${log.attemptNumber}回:${log.totalCount}枚 ${log.playerCount}人 崩した人:${escapeDiscordText(log.loserName)}\n`;
    });
    response += "★崩した人上位10位★\n";
    loserCounts.forEach((loser, index) => {
      response += `-# ${index + 1}位: ${escapeDiscordText(loser.loserName)} (${loser.count}回)\n`;
    });

    // ▼▼▼ ここからが自分の順位を表示する追加ロジック ▼▼▼

  const myUsername = interaction.user.username;
  let myCollapseCount = 0; // ★1. letで変数を宣言し、0で初期化
  let myRankText = "";

  // 2. 自分がTOP10に入っているかチェック
  const myTop10Data = loserCounts.find(loser => loser.loserName === myUsername);

  if (myTop10Data) {
    // 3a. TOP10に入っていた場合、そのデータから回数を取得
    myCollapseCount = myTop10Data.count;
    // この場合、自分の順位は既に表示されているので myRankText は空のまま
  } else {
    // 3b. TOP10に入っていなかった場合、DBに問い合わせる
    myCollapseCount = await DominoLog.count({ where: { loserName: myUsername } });

    if (myCollapseCount > 0) {
      const allLosersRanked = await DominoLog.findAll({
        attributes: ["loserName"], // 順位の特定に必要なのは名前だけなので軽量化
        group: ["loserName"],
        order: [[sequelize.fn("COUNT", sequelize.col("loserName")), "DESC"]],
        raw: true,
      });
      
      const myRankIndex = allLosersRanked.findIndex(loser => loser.loserName === myUsername);
      const myRank = myRankIndex + 1;

      myRankText = `\n★あなたの記録★\n-# ${myRank}位: ${escapeDiscordText(myUsername)} (${myCollapseCount}回)`;
    } else {
      myRankText = `\n★あなたの記録★\n-# あなたはまだドミノを崩したことがありません。`;
    }
  }

  // 4. 最後に自分の順位情報をresponseに追加
  response += myRankText;

  // ▼▼▼ ここからが実績解除ロジック ▼▼▼
  // myCollapseCount は必ず正しい回数が入っているので、ここで安心して使える
    const dominoChecks = [
      { id: 53, condition: myCollapseCount >= 15 },
      { id: 54, condition: myCollapseCount >= 20 },
      { id: 55, condition: myCollapseCount >= 25 },
    ];

    const idsToUnlock = dominoChecks
      .filter(p => p.condition)
      .map(p => p.id);

    // idsToUnlockに解除すべきIDが入っている場合のみ処理を実行
    if (idsToUnlock.length > 0) {
      await unlockAchievements(interaction.client, interaction.user.id, ...idsToUnlock);
    }
  // ▲▲▲ 実績解除ロジックここまで ▲▲▲

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
  const t = await sequelize.transaction();
  try {
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

    const [currentDomino, created] = await CurrentDomino.findOrCreate({
      where: {},
      defaults: { attemptNumber: 1, totalCount: 0, totalPlayers: 0 },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

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

      await unlockAchievements(client, id, 32); //ドミノを崩した実績

      // 新しいドミノの履歴を DominoLog に保存
      await DominoLog.create(
        {
          attemptNumber: currentDomino.attemptNumber,
          totalCount: currentDomino.totalCount,
          playerCount: currentDomino.totalPlayers,
          loserName: username,
        },
        { transaction: t }
      );

      console.log("DominoLog created successfully.");

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

      await currentDomino.update(
        // ← updateの呼び出し方と
        {
          attemptNumber: currentDomino.attemptNumber + 1,
          totalCount: 0,
          totalPlayers: 0,
        },
        { transaction: t } // ← オプションの渡し方を変更
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
      await currentDomino.update(
        // ← こちらもインスタンスからupdate
        {
          totalCount: currentDomino.totalCount + randomNum,
          totalPlayers: currentDomino.totalPlayers + 1,
        },
        { transaction: t } // ← オプションを追加
      );
      //実績
      // 実績ID 29: ドミノ (1回並べた)
      await unlockAchievements(client, id, 29);

      // 実績ID 30: ドミノドミノドミノ (100回) の進捗を更新
      await updateAchievementProgress(client, id, 30);

      // 実績ID 31: ドミノドミノドミノドミノドミノドミノ (1000回) の進捗を更新
      await updateAchievementProgress(client, id, 31);

      if (randomNum === 79) {
        // 実績ID: i7 「79」
        await unlockHiddenAchievements(client, id, 7);
      }

      if (message.channel?.type === ChannelType.DM) {
        await unlockHiddenAchievements(client, id, 8); //実績i8
      }
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
    await t.commit();

    // ▼▼▼ この6行を追加 ▼▼▼
  } catch (error) {
    await t.rollback();
    console.error("Domino effect transaction failed:", error);
    try {
      await message.reply({
        content: "ドミノの処理中にエラーが発生しました。",
        ephemeral: true,
      });
    } catch (e) {}
  }
}

// エスケープ処理のサブルーチン（例 hoge_fuga_がhogefuga(fugaが斜体)にならないように
function escapeDiscordText(text) {
  return text.replace(/([_*`])/g, "\\$1"); // 特殊文字をエスケープ
}
