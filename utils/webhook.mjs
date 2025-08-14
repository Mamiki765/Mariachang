// ./utils/webhook.mjs

// 250814：「1つのチャンネルにつき2つずつ」Webhookを取得する。
// これにより、違う人がロールプレイなりきりだの、URL置換だので連投する形になっても表示が省略されるリスクを防…げるといいなあ
// Webhookのペア { hookA, hookB } をキャッシュするMap
export const cacheWebhooks = new Map();

/**
 * 【本体】チャンネルからWebhookのペアを取得・管理する新しい関数
 * @param {import('discord.js').TextChannel} channel
 * @returns {Promise<{hookA: import('discord.js').Webhook, hookB: import('discord.js').Webhook}>}
 */
export async function getWebhookPair(channel) {
  // 1. キャッシュにあれば、即座に返す
  if (cacheWebhooks.has(channel.id)) {
    return cacheWebhooks.get(channel.id);
  }

  // 2. キャッシュになければ、Discord APIから取得する
  const webhooks = await channel.fetchWebhooks();
  let hookA, hookB;

  // 3. まず「古い名前」のWebhookを探す（Webhook1個時代のを再利用する)
  const oldHook = webhooks.find((v) => v.name === "マリアのWebhook" && v.token);

  if (oldHook) {
    // 4. もし見つかったら、それを「A」に改名して再利用する
    console.log(`[Webhook Migration] Old webhook found in #${channel.name}. Renaming to 'A'...`);
    hookA = await oldHook.edit({ name: "マリアのWebhook A" });
  } else {
    // 5. 古いのがなければ、通常通り「A」を探す（なければ作る）
    hookA = webhooks.find((v) => v.name === "マリアのWebhook A" && v.token) ?? 
            await channel.createWebhook({ name: "マリアのWebhook A" });
  }

  // 6. 「B」は、常になければ作る
  hookB = webhooks.find((v) => v.name === "マリアのWebhook B" && v.token) ?? 
          await channel.createWebhook({ name: "マリアのWebhook B" });

  const webhookPair = { hookA, hookB };
  cacheWebhooks.set(channel.id, webhookPair);
  return webhookPair;
}

/**
 * 他のファイルのための下位互換ラッパー
 * 前はwebhookのキャッシュを自前で保持し速度向上してたやつ
 * 「1個時代のサブルーチンをAだけを返す形で再現してるわけね」
 * 内部で新しい関数を呼び出し、片方だけを返すことで、既存のコードを壊さない
 * @param {import('discord.js').TextChannel} channel
 */
export async function getWebhookInChannel(channel) {
  const { hookA } = await getWebhookPair(channel);
  return hookA;
}

/**
 * 前はチャンネル内のWebhookを全て取得してたやつ。tokenがある、つまりマリアが作ったのを探してた
 * こちらも同様にラッパーとして残す
 * @param {import('discord.js').TextChannel} channel
 */
export async function getWebhook(channel) {
    const { hookA } = await getWebhookPair(channel);
    return hookA;
}