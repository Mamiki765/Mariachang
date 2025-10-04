// tasks/rss-watcher.mjs

import cron from 'node-cron';
import Parser from 'rss-parser';
import { EmbedBuilder } from 'discord.js';
import config from '../config.mjs';
import { getSupabaseClient } from '../utils/supabaseClient.mjs';
import { getWebhookPair } from '../utils/webhook.mjs';
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
  console.log('[RSS Watcher] フィードのチェックを開始します...');
  
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
      
      const itemsToProcess = feed.items.reverse().slice(0, config.rssWatcher.maxPostsPerCheck);

      for (const item of itemsToProcess) {
        const { data } = await supabase.from('notified_rss_items').select('url').eq('url', item.link).single();
        if (data) continue;

        const nitterDomain = new URL(task.rssUrl).hostname;
        const twitterLink = item.link.replace(nitterDomain, 'twitter.com');
        
        const descriptionHtml = item.description || '';
        const imageUrls = [];
        const imgRegex = /<img src="([^"]+)"/g;
        let match;
        while ((match = imgRegex.exec(descriptionHtml)) !== null && imageUrls.length < 4) {
          imageUrls.push(match[1]); // URLはNitterのままでOK (Webhookがプロキシしてくれる)
        }
        const cleanDescription = descriptionHtml.replace(/<[^>]*>/g, '').trim();

        const authorName = item.creator ? item.creator.substring(1) : "Unknown";
        const avatarURL = `https://${nitterDomain}/${authorName}/avatar`;
        const authorUrl = `https://twitter.com/${authorName}`;
        
        // ▼▼▼ ここからが複数Embedを構築するロジックです ▼▼▼

        const embedsArray = [];

        // 1. 最初のEmbedを生成（これがメインコンテンツになる）
        const mainEmbed = new EmbedBuilder()
          .setAuthor({ name: item.creator, iconURL: avatarURL, url: authorUrl })
          .setURL(twitterLink) // URLはここにも設定
          .setDescription(cleanDescription || item.title)
          .setColor("#1DA1F2")
          .setTimestamp(new Date(item.isoDate))
          .setFooter({ text: `From: ${task.name}` });

        // 2. 1枚目の画像があれば、メインのEmbedに設定
        if (imageUrls.length > 0) {
          mainEmbed.setImage(imageUrls[0]);
        }
        embedsArray.push(mainEmbed);

        // 3. 2枚目以降の画像があれば、画像だけのシンプルなEmbedを追加
        if (imageUrls.length > 1) {
          for (const imageUrl of imageUrls.slice(1)) {
            const imageEmbed = new EmbedBuilder()
              .setURL(twitterLink) // メインと同じURLを設定するのがポイント
              .setImage(imageUrl);
            embedsArray.push(imageEmbed);
          }
        }
        
        // ▲▲▲ Embed構築ロジックはここまで ▲▲▲

        const lastMessages = await webhookPair.hookA.channel.messages.fetch({ limit: 1 });
        const lastMessage = lastMessages.first();
        let webhookToUse = webhookPair.hookA;
        if (lastMessage?.webhookId === webhookPair.hookA.id) {
          webhookToUse = webhookPair.hookB;
        }
        
        // 構築したEmbedの配列を一度に送信！
        await webhookToUse.send({
          username: authorName,
          avatarURL: avatarURL,
          embeds: embedsArray, // 配列を渡す
        });
        
        await supabase.from('notified_rss_items').insert({ url: item.link });
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
  console.log('[RSS Watcher] RSS監視タスクとクリーンアップタスクがスケジュールされました。');
}