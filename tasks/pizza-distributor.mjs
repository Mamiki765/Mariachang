// tasks/pizza-distributor.mjs (RPCバージョン)
import cron from "node-cron";
import { activeUsersForPizza } from "../handlers/messageCreate.mjs";
import { getSupabaseClient } from "../utils/supabaseClient.mjs";
import config from "../config.mjs";
import { IdleGame, Mee6Level, UserAchievement } from "../models/database.mjs";
import { calculateOfflineProgress } from "../utils/idle-game-calculator.mjs";

/**
 * 定期的にピザを配布するタスクを開始する
 */
export function startPizzaDistribution() {
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
      ],
    });

    console.log(
      `[CALC_ALL] ${offset + users.length}人までのデータ更新が完了しました。`
    );
    offset += CHUNK_SIZE;
  }
}
