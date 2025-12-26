// tasks/atelier-checker.mjs
// APIアクセスとDiscord通知を、このファイル一つで完結させます。

import axios from "axios";
import { EmbedBuilder } from "discord.js";
import config from "../config.mjs";
import { getSupabaseClient } from "../utils/supabaseClient.mjs";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const atelierCardsQuery = fs.readFileSync(
  path.join(__dirname, "graphql", "getAtelierCards.graphql"),
  "utf8"
);

/**
 * ロスアカのアトリエカードを簡易チェックし、「予約期間中」のカードがあれば通知します。
 * この関数は、APIアクセスからメッセージ作成、送信までを一貫して行います。
 * @param {import('discord.js').Client} client Discordクライアント
 */
export async function checkAtelierCards(client) {
  const supabase = getSupabaseClient();
  try {
    // ★ 全体をtry...catchで囲むと、より安全になります

    // --- 1. 最終チェック時刻を取得し、実行するか判断する ---
    const { data: taskLog, error: logError } = await supabase
      .from("task_logs")
      .select("last_successful_run")
      .eq("task_name", "atelier-checker") // ★ "atelier-checker" という新しい名前で記録
      .single();

    if (logError && logError.code !== "PGRST116") {
      // 'PGRST116'は「行が見つからない」エラーなので、初回実行時は無視
      throw logError;
    }

    const lastRun = taskLog
      ? new Date(taskLog.last_successful_run)
      : new Date(0); // 前回実行時刻
    const now = new Date(); // 今回の実行時刻

    // 1. 「今日のロスアカの始まり」である「朝8時」を定義します。
    let lossAcadiaTodayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      8,
      5, //ロスアカ側のサーバーの処理時間を考慮し、8:05に設定
      0
    );

    // 2. もし、今の時刻が朝8時5分より前（例: 7:59）なら、
    //    「今日のロスアカ」はまだ始まっていないので、判定基準となる「壁」は「昨日の朝8時」になります。
    if (now < lossAcadiaTodayStart) {
      lossAcadiaTodayStart.setDate(lossAcadiaTodayStart.getDate() - 1);
    }

    // 3. 【判定】前回の実行時刻が、この「今日のロスアカの始まり」よりも後であれば、
    //    それは「今日のチェックは、もう誰かが済ませた」ということなので、処理を終了します。
    if (lastRun > lossAcadiaTodayStart) {
      console.log(
        `[rev2エクストラカード] 本日（エクストラカード更新 ${lossAcadiaTodayStart.toLocaleDateString("ja-JP")} 8:05以降）のチェックは既に完了済みのため、スキップします。`
      );
      return;
    }
    console.log("[rev2エクストラカード]簡易チェックを開始します...");

    // --- 1. APIから1ページ目のカード情報を取得 ---
    // このtry...catchブロックは、外部APIとの通信の安定性を担保します。
    let cards;
    try {
      const url =
        "https://rev2.reversion.jp/graphql?opname=GetOnSellingIllustExtraCardList";
      const headers = {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
        Referer: "https://rev2.reversion.jp/shop/illust/excard/search",
      };
      const payload = {
        operationName: "GetOnSellingIllustExtraCardList",
        variables: { page: 1 },
        query: atelierCardsQuery, // ← 長い文字列の代わりにこの変数を指定
      };

      const response = await axios.post(url, payload, {
        headers,
        timeout: 15000,
      });
      cards = response.data.data.rev2IllustExtraCardsOnSale.data;
    } catch (error) {
      console.error(
        `[rev2エクストラカード]API リクエストに失敗しました: ${error.message}`
      );
      return; // APIアクセスに失敗したら、ここで処理を静かに中断します。
    }

    // --- 2. 取得したデータを検証・集計 ---
    // APIからデータが取得できなかったか、現在出品が1件もない場合は、ここで終了します。
    if (!cards || cards.length === 0) {
      console.log(
        "[rev2エクストラカード]情報が取得できなかったか、現在出品がありません。"
      );
      return;
    }

    // 「予約期間中」と「販売中」のカードを、それぞれ数えます。
    let reservedCount = 0;
    let onSaleCount = 0;

    for (const card of cards) {
      if (card.status_name === "予約期間中") {
        reservedCount++;
      } else if (card.status_name === "販売中") {
        onSaleCount++;
      }
    }

    // ログに、見つけたカードの数を記録します。
    console.log(
      `[rev2エクストラカード] 状況: 予約期間中(${reservedCount}件), 販売中(${onSaleCount}件)`
    );

    // 予約中のカードが1枚もなければ、通知する必要はないので、ここで終了します。
    if (reservedCount === 0) {
      // 0枚でもログを残してから終了する
      await supabase.from("task_logs").upsert({
        task_name: "atelier-checker",
        last_successful_run: new Date().toISOString(),
      });
      console.log(
        "[rev2エクストラカード]現在、予約期間中のアトリエカードはありませんでした。"
      );
      return;
    }

    // --- 3. 通知メッセージを作成 ---
    let message = `**${reservedCount}枚**のエクストラカードが登録されたようですにゃ！`;

    // 【あなたの名案】もし取得した50件すべてが予約中なら、もっと多い可能性があることを示唆する。
    if (cards.length === 50 && reservedCount === 50) {
      message = `**50枚以上**のエクストラカードが登録されたようですにゃ！！！`;
    }

    // --- 4. Discordに通知を送信 ---
    // このtry...catchブロックは、Discordへの通知が失敗してもBot全体が落ちないようにします。
    try {
      const channel = await client.channels.fetch(config.rev2ch); // config.mjsに通知先チャンネルIDを追加してください

      const embed = new EmbedBuilder()
        .setColor("Fuchsia") // 予約期間中なので、華やかな色に
        .setTitle("🎨本日のEXカード")
        .setDescription(message)
        .setURL("https://rev2.reversion.jp/shop/illust/excard/search")
        .setTimestamp()
        .setFooter({
          text: "権利上画像取得やログ保存はしてないのでご了承くださいにゃ。",
        });

      await channel.send({ embeds: [embed] });
      console.log(`[rev2エクストラカード]予約情報を通知しました: ${message}`);
    } catch (error) {
      console.error(
        "[rev2エクストラカード]通知送信中にエラーが発生しました:",
        error
      );
    }
    await supabase.from("task_logs").upsert({
      task_name: "atelier-checker", // このタスクの名前で
      last_successful_run: new Date().toISOString(), // 今の時刻を記録
    });
    console.log("[rev2エクストラカード] チェックを正常に完了しました。");
  } catch (error) {
    console.error(
      "[rev2エクストラカード] チェック処理全体でエラーが発生しました:",
      error
    );
  }
}
