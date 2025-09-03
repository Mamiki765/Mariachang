// tasks/pizza-distributor.mjs (RPCバージョン)
import cron from "node-cron";
import { activeUsersForPizza } from "../handlers/messageCreate.mjs";
import { getSupabaseClient } from "../utils/supabaseClient.mjs";
import config from "../config.mjs";

/**
 * 定期的にピザを配布するタスクを開始する
 */
export function startPizzaDistribution() {
  cron.schedule("*/1 * * * *", async () => {
    if (activeUsersForPizza.size === 0) {
      return;
    }

    const userIds = [...activeUsersForPizza];
    activeUsersForPizza.clear();

   // console.log(`[RPC] ${userIds.length}人のユーザーにピザを配布します。`);

    try {
      const supabase = getSupabaseClient();
      const { min, max } = config.chatBonus.legacy_pizza.amount;

      // ★★★ ここがRPCの呼び出し！ ★★★
      // 'increment_legacy_pizza' という名前の関数を呼び出す
      const { error } = await supabase.rpc('increment_legacy_pizza', {
        // SQL関数で定義した引数名をキーとして、値を渡す
        user_ids: userIds,
        min_amount: min,
        max_amount: max,
      });

      if (error) {
        // RPCの実行でエラーがあれば、それを投げる
        throw error;
      }

      console.log(`[RPC]${userIds.length}人のユーザーへのピザ配布が完了しました。`);

    } catch (error) {
      console.error("[RPC]ピザ配布タスクでエラーが発生しました:", error);
    }
  });
}