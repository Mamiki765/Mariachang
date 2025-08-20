// ./utils/webhook.mjs
import { dominoeffect } from "../commands/utils/domino.mjs"; 
import config from "../config.mjs"; 
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

/**
 * 【RP投稿専用】キャラクターとしてWebhookでメッセージを送信する多機能関数
 * @param {import('discord.js').CommandInteraction | import('discord.js').ModalSubmitInteraction} interaction - 操作の起点となるインタラクション
 * @param {object} character - SequelizeのCharacterモデルのインスタンス
 * @param {object} icon - SequelizeのIconモデルのインスタンス
 * @param {string} message - 投稿するメッセージ本文
 * @param {boolean} nocredit - 権利表記を省略するかどうか
 * @returns {Promise<import('discord.js').Message>} 送信されたメッセージオブジェクト
 */
// 必要なライブラリをファイルの先頭に追加するのを忘れずに
// import { updatePoints } from "../commands/slashs/roleplay.mjs"; のように
// ただし、循環参照を避けるため、設計には注意が必要です。
// もしエラーが出たら、updatePointsを呼び出す部分をコメントアウトするか、
// イベントを発行するなどの高度な方法が必要になります。
// 今回は、まず動かすことを優先しましょう。
export async function sendWebhookAsCharacter(interaction, character, icon, message, nocredit) {
  // ---- 1. 必要な情報を準備する ----
  const name = character.name;
  let pbwflag = character.pbwflag;
  const face = icon ? icon.iconUrl : null;
  const copyright = icon ? icon.illustrator : null;

  // ---- 2. 権利表記を組み立てる ----
  // PBWフラグにイラストレーター名が含まれているかチェック
  if (pbwflag && pbwflag.includes("illustratorname")) {
    pbwflag = pbwflag.replace("illustratorname", copyright);
  } else if (!nocredit) {
    // 権利表記が必要なのに、フラグがおかしい場合はエラーを投げる
    // これにより、呼び出し元でエラーハンドリングができる
    throw new Error(
      "権利表記のフォーマットが無効です。`/roleplay register`からキャラクターを再登録してください。"
    );
  }

  // ---- 3. 最終的なメッセージを組み立てる ----
  let finalMessage = message
    .replace(/@@@/g, "\n")
    .replace(/<br>/g, "\n")
    .replace(/\\n/g, "\n");

  if (!nocredit) {
    finalMessage += "\n" + `-# ` + pbwflag;
  }

  // ---- 4. Webhookを取得して使い分ける ----
  const webhookTargetChannel = interaction.channel.isThread()
    ? interaction.channel.parent
    : interaction.channel;
  const threadId = interaction.channel.isThread() ? interaction.channel.id : null;
  
  // getWebhookPairは、このファイル内にすでにあるので、そのまま使えます
  const { hookA, hookB } = await getWebhookPair(webhookTargetChannel);
  
  const lastMessages = await interaction.channel.messages.fetch({ limit: 1 });
  const lastMessage = lastMessages.first();
  let webhookToUse = hookA;
  if (
    lastMessage &&
    lastMessage.webhookId &&
    lastMessage.webhookId === hookA.id
  ) {
    webhookToUse = hookB;
  }

  // ---- 5. Webhookでメッセージを送信する ----
  const postedMessage = await webhookToUse.send({
    content: finalMessage,
    username: name,
    threadId: threadId,
    avatarURL: face,
  });

  // ---- 6. 追加処理（ポイント更新など） ----
  // 循環参照を避けるため、ここでは updatePoints の直接インポートはせず、
  // interaction.client.emit('updatePoints', interaction.user.id); のような
  // イベント駆動にするのが理想ですが、まずは動かすことを優先します。
  // ここで updatePoints を呼び出す場合は、循環参照エラーに注意してください。
  // (今回は、呼び出し元で updatePoints を呼ぶ形に戻しましょう)
  if (
    finalMessage.match(/(どみの|ドミノ|ﾄﾞﾐﾉ|domino|ドミドミ|どみどみ)/i) ||
    interaction.channel.id === config.dominoch
  ) {
    dominoeffect(
      postedMessage,
      interaction.client,
      interaction.user.id,
      interaction.user.username,
      name
    );
  }

  // ---- 7. 送信したメッセージを返す ----
  // これにより、呼び出し元で「削除ボタン」などを付けられるようになります
  return postedMessage;
}