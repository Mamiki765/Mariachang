// tasks/atelier-checker.mjs
// APIアクセスとDiscord通知を、このファイル一つで完結させます。

import axios from 'axios';
import { EmbedBuilder } from 'discord.js';
import config from '../config.mjs';

/**
 * ロスアカのアトリエカードを簡易チェックし、「予約期間中」のカードがあれば通知します。
 * この関数は、APIアクセスからメッセージ作成、送信までを一貫して行います。
 * @param {import('discord.js').Client} client Discordクライアント
 */
export async function checkAtelierCards(client) {
  console.log('[rev2エクストラカード]簡易チェックを開始します...');

  // --- 1. APIから1ページ目のカード情報を取得 ---
  // このtry...catchブロックは、外部APIとの通信の安定性を担保します。
  let cards;
  try {
    const url = 'https://rev2.reversion.jp/graphql?opname=GetOnSellingIllustExtraCardList';
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      'Referer': 'https://rev2.reversion.jp/shop/illust/excard/search'
    };
    const payload = {
      "operationName": "GetOnSellingIllustExtraCardList",
      "variables": { "page": 1 }, // 1ページ目だけを取得
      "query": "query GetOnSellingIllustExtraCardList($page: Int, $penname: String, $product_size_ids: [ID!], $list_sort: String, $sort_key: Int, $include_unused: Boolean, $my_unused: Boolean) { rev2IllustExtraCardsOnSale(page: $page, penname: $penname, product_size_ids: $product_size_ids, list_sort: $list_sort, sort_key: $sort_key, include_unused: $include_unused, my_unused: $my_unused, first: 50) { paginatorInfo { total perPage __typename } data { ...ShopIllustExcardListItem __typename } __typename } } fragment ShopIllustExcardListItem on ReversionIllustExtraCard { id reserve_start sell_start sell_end_at total_price status_name is_reserved maximum_size { normal_image_url __typename } creator { id penname image_icon_url __typename } __typename }"
    };

    const response = await axios.post(url, payload, { headers, timeout: 15000 });
    cards = response.data.data.rev2IllustExtraCardsOnSale.data;

  } catch (error) {
    console.error(`[rev2エクストラカード]API リクエストに失敗しました: ${error.message}`);
    return; // APIアクセスに失敗したら、ここで処理を静かに中断します。
  }
  
  // --- 2. 取得したデータを検証・集計 ---
  // APIからデータが取得できなかったか、現在出品が1件もない場合は、ここで終了します。
  if (!cards || cards.length === 0) {
    console.log('[rev2エクストラカード]情報が取得できなかったか、現在出品がありません。');
    return;
  }

  // 「予約期間中」と「販売中」のカードを、それぞれ数えます。
  let reservedCount = 0;
  let onSaleCount = 0;
  
  for (const card of cards) {
    if (card.status_name === '予約期間中') {
      reservedCount++;
    } else if (card.status_name === '販売中') {
      onSaleCount++;
    }
  }
  
  // ログに、見つけたカードの数を記録します。
  console.log(`[rev2エクストラカード] 状況: 予約期間中(${reservedCount}件), 販売中(${onSaleCount}件)`)

  // 予約中のカードが1枚もなければ、通知する必要はないので、ここで終了します。
  if (reservedCardsCount === 0) {
    console.log('[rev2エクストラカード]現在、予約期間中のアトリエカードはありませんでした。');
    return;
  }

  // --- 3. 通知メッセージを作成 ---
  let message = `**${reservedCardsCount}枚**のエクストラカードが登録されたようですにゃ！`;

  // 【あなたの名案】もし取得した50件すべてが予約中なら、もっと多い可能性があることを示唆する。
  if (cards.length === 50 && reservedCardsCount === 50) {
    message = `**50枚以上**のエクストラカードが登録されたようですにゃ！！！`;
  }

  // --- 4. Discordに通知を送信 ---
  // このtry...catchブロックは、Discordへの通知が失敗してもBot全体が落ちないようにします。
  try {
    const channel = await client.channels.fetch(config.atelierChannelId); // config.mjsに通知先チャンネルIDを追加してください

    const embed = new EmbedBuilder()
      .setColor('Fuchsia') // 予約期間中なので、華やかな色に
      .setTitle('🎨本日のEXカード')
      .setDescription(message)
      .setURL('https://rev2.reversion.jp/shop/illust/excard/search')
      .setTimestamp()
      .setFooter({ text: '権利上画像取得やログ保存はしてないのでご了承くださいにゃ。' });

    await channel.send({ embeds: [embed] });
    console.log(`[rev2エクストラカード]予約情報を通知しました: ${message}`);

  } catch (error) {
    console.error('[rev2エクストラカード]通知送信中にエラーが発生しました:', error);
  }
}