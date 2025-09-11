// tasks/pizza-distributor.mjs (RPCバージョン)
import cron from "node-cron";
import { activeUsersForPizza } from "../handlers/messageCreate.mjs";
import { getSupabaseClient } from "../utils/supabaseClient.mjs";
import config from "../config.mjs";

/**
 * 定期的にピザを配布するタスクを開始する
 */
export function startPizzaDistribution() {
  // 毎時 0分, 10分, 20分, 30分, 40分, 50分に実行
  //人口を増加させ、ボーナス率を記録しておく
  cron.schedule("*/10 * * * *", async () => {
    console.log(
      "[BONUS_CALC] 全ユーザーの人口ボーナス更新処理を呼び出します。"
    );
    try {
      const supabase = getSupabaseClient();
      // ★★★ 作成したSQL関数を呼び出すだけ！ ★★★
      const { error } = await supabase.rpc("update_all_idle_games_and_bonuses");
      if (error) throw error;
      console.log("[BONUS_CALC] 更新処理が正常に完了しました。");
    } catch (error) {
      console.error(
        "[BONUS_CALC] ボーナス更新処理でエラーが発生しました:",
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
