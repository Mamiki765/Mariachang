import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
//削除ボタン（最初にメンションされている人だけが消せる）
// content: `<@${interaction.user.id}>`などでIDをメッセージの先頭に付けておくこと
export const deletebutton = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setEmoji("🗑️")
    .setLabel("削除")
    .setStyle(ButtonStyle.Danger)
    .setCustomId("delete")
);
//削除ボタン（誰でも消せる、DMとかpingなど一人しかそもそも押せない、誰でも押せる奴につかう）
export const deletebuttonanyone = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setEmoji("🗑️")
    .setLabel("削除")
    .setStyle(ButtonStyle.Danger)
    .setCustomId("deleteanyone")
);

//削除ボタン(ID内に削除できる人の情報を埋め込む最新式)
export function deletebuttonunique(id) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setEmoji("🗑️")
      .setLabel("削除")
      .setCustomId(`UniqueDelete-${id}`)
      .setStyle(ButtonStyle.Danger)
  );
}

//削除時の確認ボタン2種類
const confirmationButton = new ButtonBuilder()
  .setEmoji("✅")
  .setCustomId("confirm_delete")
  .setLabel("削除する")
  .setStyle(ButtonStyle.Danger);
const cancelButton = new ButtonBuilder()
  .setEmoji("❌")
  .setCustomId("cancel_delete")
  .setLabel("キャンセル")
  .setStyle(ButtonStyle.Secondary);
export const deleteconfirm = new ActionRowBuilder().addComponents(
  confirmationButton,
  cancelButton
);

//(admin用)
//DMにつけられた返信ボタン
export const replyfromDM = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setEmoji("✉️")
    .setCustomId("admin_replyfromDM")
    .setLabel("返信(1度だけできます)")
    .setStyle(ButtonStyle.Secondary)
);
//DMからの返信に更に返信するボタン
// 引数で受け取った番号を使って CustomId を設定する
export function replytoDM(id) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setEmoji("✉️")
      .setCustomId(`admin_replytoDM-${id}`)
      .setLabel("返信")
      .setStyle(ButtonStyle.Secondary)
  );
}

//セルフタイムアウトの確認ボタン
export function selftimeout_check(minutes) {
  const timeout_ok = new ButtonBuilder()
    .setEmoji("💤")
    .setCustomId(`confirm_selftimeout-${minutes}`)
    .setLabel(`${minutes}分タイムアウトする`)
    .setStyle(ButtonStyle.Danger);
  const timeout_cancel = new ButtonBuilder()
    .setEmoji("❌")
    .setCustomId(`cancel_selftimeout`)
    .setLabel("キャンセル")
    .setStyle(ButtonStyle.Secondary);
  const timeout = new ActionRowBuilder().addComponents(
    timeout_ok,
    timeout_cancel
  );
  return [timeout];
}

//ログインボーナス用のボタン本体
export const acornLoginButtonComponent = new ButtonBuilder()
  .setEmoji("🐿️")
  .setCustomId("claim_acorn_login_bonus")
  .setLabel("あまやどんぐりを拾う")
  .setStyle(ButtonStyle.Success);

// ログインボーナス用のボタンを追加
export const acornLoginButton = new ActionRowBuilder().addComponents(
  acornLoginButtonComponent // 作成したボタン本体を入れる
);
/**
 * 【ステップ1】RP投稿を削除するための、投稿者専用ボタンを作成します。
 * @param {string} messageId 削除対象のメッセージID
 * @param {string} userId このボタンを押すことを許可されたユーザーのID
 * @returns {import('discord.js').ActionRowBuilder} ボタンを含むActionRow
 */
export function createRpDeleteRequestButton(messageId, userId) {
  const deleteButton = new ButtonBuilder()
    .setCustomId(`delete-rp-post_${messageId}_${userId}`)
    .setLabel("今の発言をキャンセル")
    .setStyle(ButtonStyle.Danger);

  return new ActionRowBuilder().addComponents(deleteButton);
}

/**
 * 【ステップ2】最終確認のための、「はい」と「いいえ」のボタンセットを作成します。
 * @param {string} messageId 削除対象のメッセージID
 * @param {string} userId 許可されたユーザーのID
 * @returns {import('discord.js').ActionRowBuilder}
 */
export function createRpDeleteConfirmButtons(messageId, userId) {
  const confirmButton = new ButtonBuilder()
    // これが、本当に削除を実行するボタンのID
    .setCustomId(`confirm-delete-rp-post_${messageId}_${userId}`)
    .setLabel("はい、完全に削除します")
    .setStyle(ButtonStyle.Danger); // ここで初めて、危険な赤色が登場する

  const cancelButton = new ButtonBuilder()
    .setCustomId(`cancel-delete-rp-post`) // キャンセルに情報は不要
    .setLabel("いいえ、やめておきます")
    .setStyle(ButtonStyle.Secondary);

  return new ActionRowBuilder().addComponents(confirmButton, cancelButton);
}

/**
 * ログインボーナス受け取り後に表示するボタンセットを作成します。
 * @returns {import('discord.js').ActionRowBuilder}
 */
export function createLoginResultButtons() {
  // 1. ロスアカへのリンクボタン
  const lostArcadiaButton = new ButtonBuilder()
    .setLabel("ロスアカの公式サイトへ") // ボタンのテキスト
    .setStyle(ButtonStyle.Link) // ★これが重要！ リンクボタンにする
    .setURL("https://rev2.reversion.jp"); // ここにURLを設定

  // 2. 通貨説明を表示するボタン
  const currencyInfoButton = new ButtonBuilder()
    .setCustomId("show_currency_help") // このボタンだけの特別なID
    .setLabel("雨宿りの通貨について")
    .setStyle(ButtonStyle.Secondary); // 補助的なのでSecondaryが良いでしょう

  return new ActionRowBuilder().addComponents(
    lostArcadiaButton,
    currencyInfoButton
  );
}

/**
 * ロスアカのステシ呼び出し記法チュートリアル表示ボタン
 * @returns {import('discord.js').ActionRowBuilder}
 */
export function createCharacterNotationHelpButton() {
  const notationHelpButton = new ButtonBuilder()
    .setCustomId("show_character_notation_help")
    .setLabel("ロスアカ記法ヘルプ")
    .setStyle(ButtonStyle.Secondary)
    .setEmoji("📘");

  return new ActionRowBuilder().addComponents(notationHelpButton);
}

export const toggleLogiboNotificationButton = new ButtonBuilder()
  .setCustomId("toggle_logibo_notification")
  .setLabel("通知設定を切り替える")
  .setStyle(ButtonStyle.Secondary)
  .setEmoji("🔕"); 
