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
    const myTop10Data = loserCounts.find(
      (loser) => loser.loserName === myUsername
    );

    if (myTop10Data) {
      // 3a. TOP10に入っていた場合、そのデータから回数を取得
      myCollapseCount = myTop10Data.count;
      // この場合、自分の順位は既に表示されているので myRankText は空のまま
    } else {
      // 3b. TOP10に入っていなかった場合、DBに問い合わせる
      myCollapseCount = await DominoLog.count({
        where: { loserName: myUsername },
      });

      if (myCollapseCount > 0) {
        const allLosersRanked = await DominoLog.findAll({
          attributes: ["loserName"], // 順位の特定に必要なのは名前だけなので軽量化
          group: ["loserName"],
          order: [[sequelize.fn("COUNT", sequelize.col("loserName")), "DESC"]],
          raw: true,
        });

        const myRankIndex = allLosersRanked.findIndex(
          (loser) => loser.loserName === myUsername
        );
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
      .filter((p) => p.condition)
      .map((p) => p.id);

    // idsToUnlockに解除すべきIDが入っている場合のみ処理を実行
    if (idsToUnlock.length > 0) {
      await unlockAchievements(
        interaction.client,
        interaction.user.id,
        ...idsToUnlock
      );
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
  // ■ 1. 実行結果を保存する変数を用意
  let result = null;

  // ■ 2. データベース処理（ここだけをトランザクションにする）
  try {
    result = await sequelize.transaction(async (t) => {
      const randomNum = Math.floor(Math.random() * 100);
      
      // データベースから取得してロック
      const [currentDomino] = await CurrentDomino.findOrCreate({
        where: {}, // 注意: 行が複数あると予期せぬ挙動になる可能性がありますが、今回は現状維持
        defaults: { attemptNumber: 1, totalCount: 0, totalPlayers: 0 },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      // 崩壊判定 (0の場合)
      if (randomNum === 0) {
        const totalPlayers = currentDomino.totalPlayers;
        const totalCount = currentDomino.totalCount;
        const attemptNumber = currentDomino.attemptNumber;

        // ログ保存
        await DominoLog.create(
          {
            attemptNumber: attemptNumber,
            totalCount: totalCount,
            playerCount: totalPlayers,
            loserName: username,
          },
          { transaction: t }
        );

        // 最高記録チェック用データの取得（ロック外で計算してもいいが、整合性のためここで）
        const highestLog = await DominoLog.findOne({
            order: [["totalCount", "DESC"]],
            transaction: t
        });
        const isNewRecord = highestLog && totalCount > highestLog.totalCount;

        // 0枚崩しチェック
        const isZeroCollapse = totalCount === 0;
        const zeroCount = isZeroCollapse ? (await DominoLog.count({ where: { totalCount: 0 }, transaction: t })) : 0;

        // カウントリセット
        await currentDomino.update(
          {
            attemptNumber: attemptNumber + 1,
            totalCount: 0,
            totalPlayers: 0,
          },
          { transaction: t }
        );

        // ★結果オブジェクトを返す（Discord送信はここではしない！）
        return {
            type: "COLLAPSE",
            randomNum,
            totalPlayers,
            totalCount,
            attemptNumber,
            isNewRecord,
            isZeroCollapse,
            zeroCount,
            tens: Math.floor(randomNum / 10),
            ones: randomNum % 10
        };

      } else {
        // セーフの場合
        const nextCount = currentDomino.totalCount + randomNum;
        const nextPlayers = currentDomino.totalPlayers + 1;

        await currentDomino.update(
          {
            totalCount: nextCount,
            totalPlayers: nextPlayers,
          },
          { transaction: t }
        );

        // ★結果オブジェクトを返す
        return {
            type: "SAFE",
            randomNum,
            prevCount: currentDomino.totalCount, // 足す前の値が必要なら計算調整
            currentCount: nextCount,
            currentPlayerCount: nextPlayers,
            tens: Math.floor(randomNum / 10),
            ones: randomNum % 10
        };
      }
    }); // トランザクションはここで終了（コミット完了）

  } catch (error) {
    console.error("Domino DB transaction failed:", error);
    // DB更新に失敗したらメッセージも送らず終了（あるいはエラーメッセージを返す）
    try {
        await message.reply({ content: "ドミノの処理中にエラーが発生しました。", ephemeral: true });
    } catch(e) {}
    return;
  }

  // ■ 3. 通知処理（DBロックは解放済みなので、ゆっくり処理してOK）
  if (!result) return;

  const { tens, ones, randomNum } = result;
  
  // リアクション付与（失敗してもゲーム進行には影響しないのでtry-catch推奨ですが、このままでもOK）
  const redResult = config.reddice[tens];
  const blueResult = config.bluedice[ones];
  try {
      await message.react(redResult);
      await message.react(blueResult);
  } catch (e) {
      console.warn("Reaction failed:", e.message);
  }

  const dominochannel = client.channels.cache.get(config.dominoch);

  // ▼▼▼ 崩壊時の処理 ▼▼▼
  if (result.type === "COLLAPSE") {
    try {
        await message.react("💥");
        
        const rarity = 1 / 0.99 ** result.totalPlayers;
        const fixrarity = rarity.toFixed(2);
        
        await dominochannel.send({
            flags: [4096],
            content: `# 100　<@${id}>は${result.totalPlayers}人が並べた${result.totalCount}枚のドミノを崩してしまいました！\nこれは${fixrarity}回に1回しか見られないドミノだったようです。\n${result.attemptNumber}回目の開催は終わり、${escapeDiscordText(username)}の名が刻まれました。`,
        });

        // 特別賞・新記録通知
        if (result.isZeroCollapse) {
             await dominochannel.send({ flags: [4096], content: `# __★★【特別賞】0枚で終わった回数：${result.zeroCount}回目__` });
        }
        if (result.isNewRecord) {
             await dominochannel.send({ flags: [4096], content: `# __★★【新記録】${result.totalCount}枚★★__` });
        }

        const replyMessage = await message.reply({ flags: [4096], content: `# ガッシャーン！` });
        setTimeout(() => safeDelete(replyMessage), 5000);

        // 実績解除は最後に行う（これが失敗してもゲームは成立している）
        await unlockAchievements(client, id, 32); 

    } catch (e) {
        console.error("Error in collapse notification:", e);
    }
  } 
  // ▼▼▼ セーフ時の処理 ▼▼▼
  else if (result.type === "SAFE") {
    try {
        const dpplayer = String(result.currentPlayerCount).padStart(4, "0");
        let uniqueMessage = `Take${dpplayer}:`;
        
        const messageFunc = config.dominoMessages[randomNum] || config.dominoMessages.default;
        uniqueMessage += messageFunc(dpname, randomNum);
        uniqueMessage += ` 現在:${result.currentCount}枚`;

        // 10000枚画像処理
        // 直前の枚数が必要なら result オブジェクトに含める必要がありますが、簡易的に判定
        // (厳密には (result.currentCount - randomNum) < 10000 && result.currentCount >= 10000 )
        const prevCount = result.currentCount - randomNum;

        if (prevCount < 10000 && result.currentCount >= 10000) {
            const celebrationImageURL = config.domino10000Images[Math.floor(Math.random() * config.domino10000Images.length)];
            await dominochannel.send({ content: `${uniqueMessage}\n${celebrationImageURL}`, flags: [4096] });
        } else {
            await dominochannel.send({ flags: [4096], content: uniqueMessage });
        }

        // 一時メッセージ
        if (message.channel.id !== config.dominoch) {
            const replyMessage = await message.reply({
                flags: [4096],
                content: `${randomNum}ドミドミ…Take${result.currentPlayerCount}:${result.currentCount}枚`,
            });
            setTimeout(() => safeDelete(replyMessage), 5000);
        }

        // 実績解除（非同期で投げっぱなしにするか、awaitするかは運用次第ですが、await推奨）
        await unlockAchievements(client, id, 29);
        await updateAchievementProgress(client, id, 30);
        await updateAchievementProgress(client, id, 31);
        if (randomNum === 79) await unlockHiddenAchievements(client, id, 7);
        if (message.channel?.type === ChannelType.DM) await unlockHiddenAchievements(client, id, 8);

    } catch (e) {
        console.error("Error in safe notification:", e);
    }
  }
}

// エスケープ処理のサブルーチン（例 hoge_fuga_がhogefuga(fugaが斜体)にならないように
function escapeDiscordText(text) {
  return text.replace(/([_*`])/g, "\\$1"); // 特殊文字をエスケープ
}
