//webhookのキャッシュ
export const cacheWebhooks = new Map();

export async function getWebhookInChannel(channel) {
  //webhookのキャッシュを自前で保持し速度向上
  const webhook = cacheWebhooks.get(channel.id) ?? await getWebhook(channel)
  return webhook;
}

export async function getWebhook(channel) {
  //チャンネル内のWebhookを全て取得
  const webhooks = await channel.fetchWebhooks();
  //tokenがある（＝webhook製作者がbot自身）Webhookを取得、なければ作成する
  const webhook = webhooks?.find((v) => v.token) ?? await channel.createWebhook({ name: "マリアのWebhook" });
  //キャッシュに入れて次回以降使い回す
  if (webhook) cacheWebhooks.set(channel.id, webhook);
  return webhook;
}