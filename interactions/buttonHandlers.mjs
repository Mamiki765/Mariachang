//interactions\buttonHandlers.mjs
import {
  deleteconfirm,
  createRpDeleteConfirmButtons,
} from "../components/buttons.mjs";
import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";
import {
  timeout_confirm,
  timeout_cancel,
} from "../commands/slashs/suyasuya.mjs";
import { safeDelete } from "../utils/messageutil.mjs";
import { Point, sequelize } from "../models/database.mjs";
import config from "../config.mjs";

export default async function handleButtonInteraction(interaction) {
  //以下変数定義
  //各種IDを含むボタン系の処理
  //マリアからユーザーにメッセージを送信する送信先
  const DMmatch = interaction.customId.match(/^admin_replytoDM-(\d+)$/);
  //本人だけに押せる削除ボタンのチェック
  const UniqueDeletematch = interaction.customId.match(/UniqueDelete-(\d+)/);
  const Selftimeoutmatch = interaction.customId.match(
    /confirm_selftimeout-(\d+)/
  );
  //RPキャンセルボタン
  const rpDeleteRequestMatch = interaction.customId.match(
    /^delete-rp-post_(\d+)_(\d+)$/
  );
  const rpDeleteConfirmMatch = interaction.customId.match(
    /^confirm-delete-rp-post_(\d+)_(\d+)$/
  );
  const rpDeleteCancelMatch = interaction.customId.match(
    /^cancel-delete-rp-post$/
  );
  //以下ボタン処理
  //削除ボタン
  if (
    interaction.customId == "delete" ||
    interaction.customId == "deleteanyone"
  ) {
    if (!interaction.message.mensions) {
      await interaction.message.fetch();
    } //なければ取得
    //削除ボタンを押されたとき、消せる人がanyoneでないならその本文の文頭にあるメンションの人を投稿者として認識、削除権限の有無を確かめる。
    const userIdPattern = new RegExp(`^<@${interaction.user.id}>`, "i"); //自分宛てへのメンションで始まるメッセージなら投稿者
    if (
      userIdPattern.test(interaction.message.content) ||
      interaction.customId == "deleteanyone"
    ) {
      //確認メッセージを送信
      await interaction.reply({
        content: "このメッセージを削除しますか？",
        components: [deleteconfirm],
        flags: 64, //ephemeral
      });
      return;
    } else {
      //削除権限無し
      await interaction.reply({
        content: "このメッセージを削除できるのは投稿者のみです。",
        flags: 64, //ephemeral
      });
      return;
    }
  } else if (UniqueDeletematch) {
    //削除ボタンがIDを持っていたときの挙動
    //useridが削除ボタンに入ってるやつ 　UniqueDelete-(ID)
    //削除ボタンを押されたとき、消せる人がanyoneでないならその本文の文頭にあるメンションの人を投稿者として認識、削除権限の有無を確かめる。
    const userIdFromCustomId = UniqueDeletematch[1]; // カスタムIDから数字（USERID）を取得
    if (userIdFromCustomId === interaction.user.id) {
      //確認メッセージを送信
      await interaction.reply({
        content: "このメッセージを削除しますか？",
        components: [deleteconfirm],
        flags: 64, //ephemeral
      });
      return;
    } else {
      //削除権限無し
      await interaction.reply({
        content: "このメッセージを削除できるのは投稿者のみです。",
        flags: 64, //ephemeral
      });
      return;
    }
  } else if (interaction.customId === "confirm_delete") {
    try {
      // 1. まず、削除対象のメッセージを取得しようと試みる
      const messageToDelete = await interaction.channel.messages.fetch(
        interaction.message.reference.messageId
      );

      // 2. 取得できたら、「安全に」削除する
      await safeDelete(messageToDelete);

      // 3. ユーザーに成功を報告する
      await interaction.update({
        content: "メッセージが削除されました。",
        components: [],
      });
    } catch (error) {
      // もし、そもそもメッセージの「取得(fetch)」に失敗した場合
      // (つまり、既に削除されていた場合)
      if (error.code === 10008) {
        // Unknown Message
        await interaction.update({
          content: "メッセージは既に削除されていたようです。",
          components: [],
        });
      } else {
        // それ以外の、本当に予期せぬエラーの場合
        console.error("メッセージ削除(確認)処理中に予期せぬエラー:", error);
        await interaction.update({
          content: "メッセージの削除に失敗しました。",
          components: [],
        });
      }
    }
    return;
  } else if (interaction.customId === "cancel_delete") {
    await interaction.update({
      content: "削除がキャンセルされました。",
      components: [],
    });
    return;
    //admin系、DMからの返信を受け取るmodal
  } else if (interaction.customId === "admin_replyfromDM") {
    const modal = new ModalBuilder()
      .setTitle("管理人室に返信します")
      .setCustomId("admin_replyfromDM_submit");
    const TextInput = new TextInputBuilder()
      .setLabel("メッセージ")
      .setCustomId("message")
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(2000)
      .setMinLength(2)
      .setRequired(true);
    const ActionRow = new ActionRowBuilder().setComponents(TextInput);
    modal.setComponents(ActionRow);
    return interaction.showModal(modal);
    //admin、dmからきた返信に更に返信するmodal
  } else if (DMmatch) {
    const modal = new ModalBuilder()
      .setTitle("DMに再度管理人室より返信します")
      .setCustomId(`admin_replytoDM_submit-${DMmatch[1]}`);
    const TextInput = new TextInputBuilder()
      .setLabel("メッセージ")
      .setCustomId("message")
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(2000)
      .setMinLength(2)
      .setRequired(true);
    const replyInput = new TextInputBuilder()
      .setLabel("返信を許可するか(0で禁止)")
      .setCustomId("replyable")
      .setMaxLength(1)
      .setValue("1")
      .setRequired(true)
      .setStyle(TextInputStyle.Short);
    const ActionRow = new ActionRowBuilder().setComponents(TextInput);
    const ActionRowSecond = new ActionRowBuilder().setComponents(replyInput);
    modal.setComponents(ActionRow, ActionRowSecond);
    return interaction.showModal(modal);
  } else if (Selftimeoutmatch) {
    //セルフタイムアウト
    return timeout_confirm(interaction, Selftimeoutmatch[1]);
  } else if (interaction.customId === "cancel_selftimeout") {
    return timeout_cancel(interaction);
    // ロールプレイコマンドからのModal呼び出しボタン
  } else if (interaction.customId.startsWith("show-rp-modal_")) {
    // 1. customIdからスロット番号とnocreditフラグを解析します。
    const parts = interaction.customId.split("_");
    const slot = parseInt(parts[1], 10);
    const nocredit = parts[2] === "true";

    // 2. この後のModal送信を処理するための、新しいcustomIdを生成します。
    const modalCustomId = `roleplay-post-modal_${slot}_${nocredit}`;

    // 3. ユーザーに表示するModalを構築します。
    const modal = new ModalBuilder()
      .setCustomId(modalCustomId)
      .setTitle(`スロット${slot}で発言`);

    const messageInput = new TextInputBuilder()
      .setCustomId("messageInput")
      .setLabel("発言内容")
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(1750) // ← これを追加！
      .setPlaceholder(
        "ここにセリフを入力してください。（最大1750文字)\n改行もそのまま反映されます。"
      )
      .setRequired(true);

    const actionRow = new ActionRowBuilder().addComponents(messageInput);
    modal.addComponents(actionRow);

    // 4. ボタンが押されたインタラクションへの応答として、Modalを表示します。
    return interaction.showModal(modal);
    // --- ここから下は、あまやどんぐりのログインボーナス処理 ---
  } else if (interaction.customId === "claim_acorn_login_bonus") {
    try {
      const [pointEntry, created] = await Point.findOrCreate({
        where: { userId: interaction.user.id },
      });

      // ▼▼▼ ここからが「朝8時またぎ」の資格チェックロジック ▼▼▼
      const now = new Date();
      if (pointEntry.lastAcornDate) {
        const lastClaim = new Date(pointEntry.lastAcornDate);

        // 最後に「朝8時」が来た日時を計算します。
        // 今が8時より前なら「昨日の朝8時」、8時以降なら「今日の朝8時」が基準になります。
        const last8AM = new Date();
        last8AM.setHours(8, 0, 0, 0); // 今日の朝8時に設定
        if (now < last8AM) {
          // もし今が朝8時より前なら、基準は「昨日の朝8時」になる
          last8AM.setDate(last8AM.getDate() - 1);
        }

        // 最後に押した日時が、最後に朝8時が来た日時よりも後か？
        if (lastClaim > last8AM) {
          return interaction.reply({
            content: `今日のあまやどんぐりはもう拾いました（毎朝8時にリセット）\n所持🐿️: ${(pointEntry.acorn || 0).toLocaleString()}個 累計🐿️:${pointEntry.totalacorn.toLocaleString()}個 ${config.nyowacoin}: ${(pointEntry.coin || 0).toLocaleString()}枚 ${config.casino.currencies.legacy_pizza.emoji}: ${(pointEntry.legacy_pizza || 0).toLocaleString()}枚\nロスアカもお忘れなく……https://rev2.reversion.jp`,
            ephemeral: true,
          });
        }
      }
      // ▲▲▲ ここまでが資格チェック ▲▲▲

      // 1. 更新するデータを準備するオブジェクトを作成
      // どんぐり、必ず1増える
      // acornとtotalacornを1増やし、lastAcornDateを現在日時に更新
      const updateData = {
        acorn: sequelize.literal("acorn + 1"),
        totalacorn: sequelize.literal("totalacorn + 1"),
        lastAcornDate: now,
      };

      let Message = "### あまやどんぐりを1つ拾いました🐿️"; // ログインボーナスのメッセージ
      // コイン、基本枚数に加え、確率でボーナスがある
      const coinConfig = config.loginBonus.nyowacoin; // 設定からコインの基本情報を取得
      // 基本給
      let coinsAdded = coinConfig.baseAmount;
      // 1/Nの確率でボーナス(1+1~9枚のようになる)
      if (Math.floor(Math.random() * coinConfig.bonus.chance) === 0) {
        const bonusAmount =
          Math.floor(
            Math.random() *
              (coinConfig.bonus.amount.max - coinConfig.bonus.amount.min + 1)
          ) + coinConfig.bonus.amount.min;
        coinsAdded += bonusAmount;
        Message += `\nなんと${config.nyowacoin}が**${coinsAdded}枚**も落ちていました✨✨`;
      } else {
        Message += `\n${config.nyowacoin}も**${coinsAdded}枚**落ちていたので拾いました✨`;
      }
      // 最終的なコイン加算を更新データにセット
      updateData.coin = sequelize.literal(`coin + ${coinsAdded}`);

      // レガシーピザ、ランダム基本給＋ロールに応じたボーナス
      const pizzaConfig = config.loginBonus.legacy_pizza; // 設定からレガシーピザの基本情報を取得
      // 基本給
      const basePizza =
        Math.floor(
          Math.random() *
            (pizzaConfig.baseAmount.max - pizzaConfig.baseAmount.min + 1)
        ) + pizzaConfig.baseAmount.min;
      let totalPizza = basePizza;
      Message += `\nレガシーピザも**${basePizza}枚**焼き上がったようです🍕`;
      // ロールに応じたボーナス、サーバーブースター
      if (interaction.member.roles.cache.has(pizzaConfig.boosterRoleId)) {
        totalPizza += pizzaConfig.boosterBonus;
        Message += `\nサーバーブースターのあなたに感謝の気持ちを込めて、**${pizzaConfig.boosterBonus.toLocaleString()}**枚追加で焼き上げました🍕`;
      }
      // Mee6のレベルに応じたボーナス、mee6LevelBonusesにkey valueでレベルロールとボーナス枚数を設定している
      for (const [roleId, bonusAmount] of Object.entries(
        pizzaConfig.mee6LevelBonuses
      )) {
        if (interaction.member.roles.cache.has(roleId)) {
          totalPizza += bonusAmount;
          Message += `\n雨宿りでいっぱい発言したあなたにニョワミヤ達が**${bonusAmount.toLocaleString()}**枚持ってきてくれました🍕`;
        }
      }
      Message += `合計:+**${totalPizza}**枚`; // 最後の行のおしりにくっつける
      // 最終的なレガシーピザ加算を更新データにセット
      updateData.legacy_pizza = sequelize.literal(
        `legacy_pizza + ${totalPizza}`
      );
      // 6. データベースを更新
      await pointEntry.update(updateData);
      // update()は更新内容を返さないため、reload()で最新の状態を取得します。
      const updatedPointEntry = await pointEntry.reload();
      // 7. ユーザーに成功を報告するメッセージを作成
      // 区切り線
      Message += `\n--------------------`;
      // 所持数、累計数、コイン、レガシーピザの表示、ロスアカのログボ受取をリマインド
      Message += `\n所持🐿️: ${updatedPointEntry.acorn.toLocaleString()}個 累計🐿️:${updatedPointEntry.totalacorn.toLocaleString()}個 \n${config.nyowacoin}: ${updatedPointEntry.coin.toLocaleString()}枚 ${config.casino.currencies.legacy_pizza.emoji}: ${updatedPointEntry.legacy_pizza.toLocaleString()}枚\nロスアカもお忘れなく……https://rev2.reversion.jp`;

      // 8. ユーザーに返信
      return interaction.reply({
        content: Message,
        flags: 64, //ephemeralは古い書き方なのでこちらを使用
      });
    } catch (error) {
      console.error("ログインボーナスの処理中にエラーが発生しました:", error);
      return interaction.reply({
        content: "エラーが発生しました。どんぐりを拾えなかったようです…。",
        ephemeral: true,
      });
    }
    //RP 機能　Cancelボタン処理
  } else if (rpDeleteRequestMatch) {
    // 【ステップ1：削除要求の受付】
    await interaction.deferUpdate();

    const messageId = rpDeleteRequestMatch[1];
    const authorizedUserId = rpDeleteRequestMatch[2];

    if (interaction.user.id !== authorizedUserId) {
      return interaction.followUp({
        content: "このボタンは、投稿した本人しか使用できません。",
        ephemeral: true,
      });
    }

    // ★★★ ここでメッセージを更新し、最終確認を求める ★★★
    const confirmButtons = createRpDeleteConfirmButtons(
      messageId,
      authorizedUserId
    );
    await interaction.editReply({
      content:
        "**本当に、この投稿を削除しますか？**\nこの操作は取り消せません。",
      components: [confirmButtons],
    });
  } else if (rpDeleteConfirmMatch) {
    // 【ステップ2：最終確認後の、実際の削除処理】
    await interaction.deferUpdate();

    const messageId = rpDeleteConfirmMatch[1];
    const authorizedUserId = rpDeleteConfirmMatch[2];

    if (interaction.user.id !== authorizedUserId) {
      return interaction.followUp({
        content: "このボタンは、投稿した本人しか使用できません。",
        ephemeral: true,
      });
    }

    // ★★★ ここで、今まで書いていた削除ロジックを実行します ★★★
    try {
      await interaction.channel.messages.delete(messageId);
      await interaction.editReply({
        content: "✅ 投稿を削除しました。",
        components: [],
      });
    } catch (error) {
      console.error("RP投稿の削除に失敗しました:", error);
      await interaction.editReply({
        content: "❌ 削除に失敗しました。",
        components: [],
      });
    }
  } else if (rpDeleteCancelMatch) {
    // 【ステップ2のキャンセル処理】
    await interaction.update({
      content: "削除はキャンセルされました。",
      components: [],
    });
  } else {
    //ボタンが不明のとき
    return;
  }
}
