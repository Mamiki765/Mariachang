// tasks/rss-watcher.mjs

import cron from "node-cron";
import Parser from "rss-parser";
import { EmbedBuilder } from "discord.js";
import config from "../config.mjs";
import { getSupabaseClient } from "../utils/supabaseClient.mjs";
import { getWebhookPair } from "../utils/webhook.mjs";
/**
 * ==========================================================================================
 * ★★★ データベースに関する重要メモ ★★★
 *
 * このタスクが使用する 'notified_rss_items' テーブルは、レコードが増え続けないよう、
 * Supabaseの 'pg_cron' 拡張機能を使って定期的に古いデータが自動削除されます。
 *
 * 具体的には、SupabaseのSQL Editorで定義された 'delete_old_rss_items' 関数が
 * 毎日自動実行され、3日以上経過したレコードをクリーンアップします。
 *
 * そのため、このファイル内に削除処理を実装する必要はありません。
 *
 * ==========================================================================================
 */
const parser = new Parser();
const supabase = getSupabaseClient();
const webhookCache = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function checkFeeds(client) {
  console.log("[RSS Watcher] フィードのチェックを開始します...");

  for (const task of config.rssWatcher.tasks) {
    if (!task.enabled) continue;

    try {
      const feed = await parser.parseURL(task.rssUrl);
      if (!feed || !feed.items) continue;

      let webhookPair = webhookCache.get(task.channelId);
      if (!webhookPair) {
        const channel = await client.channels.fetch(task.channelId);
        if (channel && channel.isTextBased()) {
          webhookPair = await getWebhookPair(channel);
          webhookCache.set(task.channelId, webhookPair);
        } else {
          continue;
        }
      }

      const itemsToProcess = feed.items
        .reverse()
        .slice(0, config.rssWatcher.maxPostsPerCheck);

      for (const item of itemsToProcess) {
        // ▼▼▼ 【改善点2】最初にURLを正規化（twitter.comに変換）します ▼▼▼
        const nitterDomain = new URL(task.rssUrl).hostname;
        const twitterLink = item.link.replace(nitterDomain, "twitter.com");

        // --- DBで通知済みかチェック（正規化されたURLを使用） ---
        const { data } = await supabase
          .from("notified_rss_items")
          .select("url")
          .eq("url", twitterLink)
          .single();
        if (data) continue;

        // --- HTMLから情報と画像を抽出 ---
        const descriptionHtml = item.description || "";
        const imageUrls = [];
        const imgRegex = /<img src="([^"]+)"/g;
        let match;
        while (
          (match = imgRegex.exec(descriptionHtml)) !== null &&
          imageUrls.length < 4
        ) {
          imageUrls.push(match[1]);
        }
        const cleanDescription = descriptionHtml.replace(/<[^>]*>/g, "").trim();

        // --- EmbedとWebhookの準備 ---
        const authorName = item.creator ? item.creator.substring(1) : "Unknown";
        const avatarURL = `https://${nitterDomain}/${authorName}/avatar`;

        // ▼▼▼ 【改善点1】AuthorのURLも、正規化されたツイートURLに設定します ▼▼▼
        const embedsArray = [];
        const mainEmbed = new EmbedBuilder()
          .setAuthor({
            name: item.creator,
            iconURL: avatarURL,
            url: twitterLink,
          }) // ここを変更！
          .setURL(twitterLink)
          .setDescription(cleanDescription || item.title)
          .setColor("#1DA1F2")
          .setTimestamp(new Date(item.isoDate))
          .setFooter({ text: `From: ${task.name}` });

        if (imageUrls.length > 0) {
          mainEmbed.setImage(imageUrls[0]);
        }
        embedsArray.push(mainEmbed);

        if (imageUrls.length > 1) {
          for (const imageUrl of imageUrls.slice(1)) {
            const imageEmbed = new EmbedBuilder()
              .setURL(twitterLink)
              .setImage(imageUrl);
            embedsArray.push(imageEmbed);
          }
        }

        // --- Webhookで交互に送信 ---
        const lastMessages = await webhookPair.hookA.channel.messages.fetch({
          limit: 1,
        });
        const lastMessage = lastMessages.first();
        let webhookToUse = webhookPair.hookA;
        if (lastMessage?.webhookId === webhookPair.hookA.id) {
          webhookToUse = webhookPair.hookB;
        }

        await webhookToUse.send({
          username: authorName,
          avatarURL: avatarURL,
          embeds: embedsArray,
        });

        // --- DBに通知済みとして記録（正規化されたURLを使用） ---
        await supabase.from("notified_rss_items").insert({ url: twitterLink });

        await sleep(config.rssWatcher.postDelay);
      }
    } catch (error) {
      console.error(`[RSS Watcher] タスク「${task.name}」でエラー:`, error);
    }
  }
}

export function initializeRssWatcher(client) {
  checkFeeds(client);
  cron.schedule(config.rssWatcher.cronSchedule, () => checkFeeds(client));
  console.log(
    "[RSS Watcher] RSS監視タスクとクリーンアップタスクがスケジュールされました。"
  );
}
