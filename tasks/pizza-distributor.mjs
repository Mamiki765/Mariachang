// tasks/pizza-distributor.mjs (RPCバージョン)
import cron from "node-cron";
import { activeUsersForPizza } from "../handlers/messageCreate.mjs";
import { getSupabaseClient } from "../utils/supabaseClient.mjs";
import config from "../config.mjs";
import {
  IdleGame,
  Mee6Level,
  UserAchievement,
  Point,
} from "../models/database.mjs";
import { calculateOfflineProgress } from "../idle-game/idle-game-calculator.mjs";
import { Op } from "sequelize";

/**
 * 定期的にピザを配布するタスクを開始する
 * @param {import("discord.js").Client} client - DM送信に必要
 */
export function startPizzaDistribution(client) {
  // 毎時 0分, 10分, 20分, 30分, 40分, 50分に実行
  //人口を増加させ、ボーナス率を記録しておく
  cron.schedule("*/10 * * * *", async () => {
    console.log("[CALC_ALL] 全ユーザーの人口ボーナス更新処理を開始します。");
    try {
      await updateAllUsersIdleGame(); // 新しく作る全体更新関数を呼び出す
      console.log("[CALC_ALL] 更新処理が正常に完了しました。");
    } catch (error) {
      console.error(
        "[CALC_ALL] ボーナス更新処理でエラーが発生しました:",
        error
      );
    }
  });
  //毎分起動
  //発言した人がいたら、ニョワミヤがピザをお届けする
  cron.schedule("*/1 * * * *", async () => {
    if (activeUsersForPizza.size === 0) {
      return;
    }

    const userIds = [...activeUsersForPizza];
    activeUsersForPizza.clear();

    // console.log(`[RPC] ${userIds.length}人のユーザーにピザを配布します。`);
    // ピザ・コイン双方の処理で使うのでtryの手前に置く
    const supabase = getSupabaseClient();
    try {
      const { min, max } = config.chatBonus.legacy_pizza.amount;

      // ★★★ ここがRPCの呼び出し！ ★★★
      // 'increment_legacy_pizza_with_bonus' という名前の関数を呼び出す
      const { error } = await supabase.rpc(
        "increment_legacy_pizza_with_bonus",
        {
          // SQL関数で定義した引数名をキーとして、値を渡す
          user_ids: userIds,
          min_amount: min,
          max_amount: max,
        }
      );

      if (error) {
        // RPCの実行でエラーがあれば、それを投げる
        throw error;
      }

      //console.log(`[RPC]${userIds.length}人のユーザーへのピザ配布が完了しました。`);
    } catch (error) {
      console.error("[RPC]ピザ配布タスクでエラーが発生しました:", error);
    }
    //サーバーブースターに1コインｘ鯖数を配る関数
    try {
      const { error } = await supabase.rpc("increment_booster_coin", {
        user_ids_list: userIds,
      });
      if (error) throw error;
      // ログは大量に出るので、成功時はコメントアウト推奨
      // console.log(`[RPC] Booster coin distribution completed for ${userIds.length} users.`);
    } catch (error) {
      console.error("[RPC] Booster coin distribution task failed:", error);
    }
  });
  //開発モード以外で、毎朝7:50に実行
  if (config.isProduction) {
    cron.schedule(
      "50 7 * * *",
      async () => {
        console.log(
          "[LOGIBO_AUTOCLAIM] 拾い忘れログボの配布処理を開始します。"
        );
        try {
          await distributeForgottenLoginBonus(client);
          console.log("[LOGIBO_AUTOCLAIM] 配布処理が正常に完了しました。");
        } catch (error) {
          console.error(
            "[LOGIBO_AUTOCLAIM] 配布処理でエラーが発生しました:",
            error
          );
        }
      },
      { timezone: "Asia/Tokyo" }
    );
  }
}

/**
 * 全ての放置ゲームユーザーのデータを更新する (完成版)
 */
async function updateAllUsersIdleGame() {
  // --- 1. ループの前に、必要な外部データを"全員分"まとめて取得 ---
  const allMee6Levels = await Mee6Level.findAll({ raw: true });
  const allAchievements = await UserAchievement.findAll({ raw: true });

  // --- 2. ユーザーIDで高速に検索できるよう、Mapオブジェクトに変換 ---
  const mee6Map = new Map(
    allMee6Levels.map((item) => [item.userId, item.level])
  );
  const achievementMap = new Map(
    allAchievements.map((item) => [
      item.userId,
      new Set(item.achievements?.unlocked || []),
    ])
  );

  const CHUNK_SIZE = 100; // 一度に処理するユーザー数
  let offset = 0;

  while (true) {
    // 全ユーザーのデータをチャンク単位で取得
    const users = await IdleGame.findAll({
      limit: CHUNK_SIZE,
      offset: offset,
      raw: true, // 高速化のため
    });

    if (users.length === 0) break; // 全ユーザーの処理が終わったらループを抜ける

    // --- 3. 各ユーザーのオフライン進行を計算 ---
    const updatedUsersData = users.map((user) => {
      const unlockedSet = achievementMap.get(user.userId) || new Set();
      // 3-1. 各ユーザーの「道具箱 (externalData)」を準備する
      const externalData = {
        mee6Level: mee6Map.get(user.userId) || 0, // Mapから高速に取得
        achievementCount: unlockedSet.size, // .lengthではなく.sizeを使う
        unlockedSet: unlockedSet,
      };

      // 3-2. 計算エンジンに、idleGameデータと道具箱を渡す！
      return calculateOfflineProgress(user, externalData);
    });

    // --- 4. SequelizeのbulkCreateを使って一括更新 ---
    await IdleGame.bulkCreate(updatedUsersData, {
      updateOnDuplicate: [
        "population",
        "lastUpdatedAt",
        "pizzaBonusPercentage",
        "infinityTime",
        "eternityTime",
        "generatorPower",
        "ipUpgrades",
        "infinityCount",
      ],
    });

    console.log(
      `[CALC_ALL] ${offset + users.length}人までのデータ更新が完了しました。`
    );
    offset += CHUNK_SIZE;
  }
}

/**
 * 【最終改訂版】ログインボーナスを拾い忘れたユーザーに、最低限の報酬を配布する
 * @param {import("discord.js").Client} client
 */
async function distributeForgottenLoginBonus(client) {
  // --- 1. 条件設定 ---
  const yesterday8AM = new Date();
  yesterday8AM.setDate(yesterday8AM.getDate() - 1);
  yesterday8AM.setHours(8, 0, 0, 0);

  const today7_50AM = new Date();
  today7_50AM.setHours(7, 50, 0, 0);

  // --- 2. 対象ユーザーをDBから抽出 ---
  const targetUsers = await Point.findAll({
    where: {
      lastAcornDate: { [Op.lt]: yesterday8AM },
      updatedAt: { [Op.gte]: yesterday8AM },
    },
  });

  if (targetUsers.length === 0) {
    console.log("[LOGIBO_AUTOCLAIM] 対象ユーザーはいませんでした。");
    return;
  }
  console.log(
    `[LOGIBO_AUTOCLAIM] ${targetUsers.length}人の対象ユーザーに配布します。`
  );

  const userIds = targetUsers.map((u) => u.userId);

  // --- 3. 必要な外部データを一括取得 ---
  // ① Mee6レベル
  const allMee6Levels = await Mee6Level.findAll({
    where: { userId: { [Op.in]: userIds } },
    raw: true,
  });
  const mee6Map = new Map(
    allMee6Levels.map((item) => [item.userId, item.level])
  );

  // ② サーバーブースト数 (Supabase RPCを利用)
  const supabase = getSupabaseClient();
  const { data: boosterCounts, error: rpcError } = await supabase.rpc(
    "get_booster_counts_for_users",
    { user_ids: userIds }
  );
  if (rpcError) {
    console.error(
      "[LOGIBO_AUTOCLAIM] Supabase RPC (get_booster_counts_for_users) failed:",
      rpcError
    );
    // RPCが失敗しても処理は続行するが、ブースト数は0として扱う
  }
  const boosterMap = new Map(
    boosterCounts?.map((item) => [item.user_id, item.boost_count]) || []
  );

  // --- 4. 各ユーザーの報酬を計算し、一括更新用のデータを作成 ---
  const bulkUpdateData = [];
  const dmPromises = [];

  for (const userPoint of targetUsers) {
    const userId = userPoint.userId;
    let totalPizzaBonus = 0;

    // Mee6ボーナス
    const mee6Level = mee6Map.get(userId) || 0;
    totalPizzaBonus +=
      mee6Level * config.loginBonus.legacy_pizza.bounsPerMee6Level;

    // ブースターボーナス
    const boostCount = boosterMap.get(userId) || 0;
    if (boostCount > 0) {
      const boosterConfig = config.loginBonus.legacy_pizza.boosterBonus;
      totalPizzaBonus +=
        boosterConfig.base + boosterConfig.perServer * boostCount;
    }

    // 更新用データを作成
    bulkUpdateData.push({
      userId: userId,
      acorn: userPoint.acorn + 1,
      totalacorn: userPoint.totalacorn + 1,
      coin: userPoint.coin + 1,
      nyobo_bank: userPoint.nyobo_bank + totalPizzaBonus,
      lastAcornDate: today7_50AM,
    });

    // DM送信処理
    const dmMessage = `おはようございますにゃ、昨日のログインボーナスを少しだけお届けに参りましたにゃ。\n- あまやどんぐり: 1個\n- ${config.nyowacoin}: 1枚\n- ${config.casino.currencies.legacy_pizza.displayName}: ${totalPizzaBonus.toLocaleString()}枚 \n-# 本日のログインボーナスは、いつも通り8:00以降に雑談や /ログボ コマンドで出るボタンから受け取れます\n-# 詫び石配布などでログイン扱いになっているかもしれません、ごめんなさい！`;
    const dmPromise = client.users
      .send(userId, { content: dmMessage, flags: 4096 })
      .catch((error) => {
        // ★★★ エラーコードが50007 (DM送信不可) の場合のみ、エラーを無視する ★★★
        if (error.code !== 50007) {
          console.error(`[LOGIBO_AUTOCLAIM] 予期せぬDM送信エラー (ユーザー: ${userId}):`, error);
        }
      });
    dmPromises.push(dmPromise);
  }

  // --- 5. DBを一括更新 & DMを一斉送信 ---
  await Point.bulkCreate(bulkUpdateData, {
    updateOnDuplicate: [
      "acorn",
      "totalacorn",
      "coin",
      "nyobo_bank",
      "lastAcornDate",
    ],
  });

  await Promise.all(dmPromises);
}
