//interactions\buttonHandlers.mjs
import {
  deleteconfirm,
  createRpDeleteConfirmButtons,
  createLoginResultButtons,
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
import { Point, IdleGame } from "../models/database.mjs";
// 放置ゲームの人口を更新する関数をインポート
import {
  getSingleUserUIData,
  formatNumberJapanese_Decimal,
  formatNumberDynamic,
} from "../idle-game/idle-game-calculator.mjs";
import Decimal from "break_infinity.js";
import { safeDelete } from "../utils/messageutil.mjs";
import {
  checkLoginBonusEligibility,
  executeLoginBonus,
} from "../utils/loginBonusSystem.mjs";
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
  } else if (interaction.customId === "claim_acorn_login_bonus") {
    // --- ここから下は、あまやどんぐりのログインボーナス処理 ---
    try {
      await interaction.deferReply({ ephemeral: true });

      // 1. 資格チェック
      const isEligible = await checkLoginBonusEligibility(interaction.user.id);

      if (!isEligible) {
        // 既にログボを受け取っている時の表示
        // findOrCreateではなくfindOneでOK（一度受け取っているならデータはあるはず）
        const pointEntry = await Point.findOne({
          where: { userId: interaction.user.id },
        });

        // 念のためnullチェック（ありえないはずですが安全のため）
        if (!pointEntry) {
          return interaction.editReply({ content: "データが見つかりません。" });
        }
        // 放置ゲームの人口を取得する、データがなければ0
        const idleGame = await IdleGame.findOne({
          where: { userId: interaction.user.id },
        });
        //ニョワ人口
        const population_d = idleGame
          ? new Decimal(idleGame.population)
          : new Decimal(0);
        //ブースト
        let boostMessage = "🔥なし";
        if (idleGame) {
          if (idleGame.buffExpiresAt) {
            const now = new Date();
            const remainingMs =
              idleGame.buffExpiresAt.getTime() - now.getTime();
            if (remainingMs > 0) {
              const hours = Math.floor(remainingMs / (1000 * 60 * 60));
              const minutes = Math.floor(
                (remainingMs % (1000 * 60 * 60)) / (1000 * 60)
              );
              const multiplier = idleGame.buffMultiplier || 1;
              boostMessage = `🔥x${formatNumberDynamic(multiplier, 1)} **${hours}時間${minutes}分**`;
            }
          } else {
            // idleGameはあるがブーストを一度も点火していない人向けの案内
            boostMessage = "🔥ブーストなし /idleで点火できます。";
          }
        }
        return interaction.editReply({
          content:
            `今日のあまやどんぐりはもう拾いました（毎朝8時にリセット）\n` +
            `所持🐿️: ${(pointEntry.acorn || 0).toLocaleString()}個 累計🐿️:${pointEntry.totalacorn.toLocaleString()}個` +
            ` ${config.nyowacoin}: ${(pointEntry.coin || 0).toLocaleString()}枚\n` +
            `${config.casino.currencies.legacy_pizza.emoji}: ${(pointEntry.legacy_pizza || 0).toLocaleString()}枚` +
            `<:nyowamiyarika:1264010111970574408>: ${formatNumberJapanese_Decimal(population_d)}匹 ${boostMessage}\n` +
            `ロスアカのどんぐりもお忘れなく……`,
          components: [createLoginResultButtons()], // ロスアカへのリンクボタンを追加
        });
      }

      // 2. ログボ実行 (DB更新)
      // ボタン押下なので member情報を渡す
      const { rewards, updatedPoint } = await executeLoginBonus(
        interaction.client,
        interaction.user.id,
        interaction.member,
        "button"
      );

      const { details } = rewards;

      // 3. リッチメッセージの構築 (executeLoginBonusから返ってきたデータを使用)
      let Message = "### あまやどんぐりを1つ拾いました🐿️";

      // コインメッセージ
      if (details.coinBonusMessage) {
        Message += `\nなんと${config.nyowacoin}が**${rewards.coin}枚**も落ちていました✨✨`;
      } else {
        Message += `\n${config.nyowacoin}も**${rewards.coin}枚**落ちていたので拾いました✨`;
      }

      // ピザメッセージ構築
      const pizzaMessages = [];
      const pizzaBreakdown = [];
      const nyoboChip = config.casino.currencies.legacy_pizza;

      pizzaMessages.push(
        `-# レガシーピザも**${details.basePizza.toLocaleString()}枚**焼き上がったようです🍕`
      );
      pizzaBreakdown.push(details.basePizza);

      if (details.finalMee6Bonus > 0) {
        pizzaMessages.push(
          `-# さらに雨宿りでいっぱい喋ったあなたに、ニョワミヤ達がピザを持ってきてくれました🍕 -> ${details.mee6MessagePart}: **${details.finalMee6Bonus.toLocaleString()}枚**`
        );
        pizzaBreakdown.push(details.finalMee6Bonus);
      }

      if (details.boosterBonus > 0) {
        const countStr = details.boosterCount
          ? `(${details.boosterCount}サーバー分)`
          : "";
        pizzaMessages.push(
          `-# さらにサーバーブースターのあなたに感謝を込めて、**${details.boosterBonus.toLocaleString()}枚**${countStr} 追加で焼き上げました🍕`
        );
        pizzaBreakdown.push(details.boosterBonus);
      }

      Message += `\n${pizzaMessages.join("\n")}`;
      Message += `\n**${pizzaBreakdown.join(" + ")} = 合計 ${rewards.pizza.toLocaleString()}枚の${nyoboChip.displayName}を手に入れました！**`;

      // 放置ゲーの表示用データ取得 (UI用なので別途取得して結合)
      const uiData = await getSingleUserUIData(interaction.user.id);
      let idleGameMessagePart = "";
      if (uiData) {
        // (既存の放置ゲー表示ロジック)
        const { idleGame } = uiData;
        const population_d = new Decimal(idleGame.population);
        idleGameMessagePart += ` <:nyowamiyarika:1264010111970574408>: ${formatNumberJapanese_Decimal(population_d)}匹`;
        // ... ブースト表示ロジック ...
      }

      Message += `\n--------------------`;
      Message += `\n所持🐿️: ${updatedPoint.acorn.toLocaleString()}個 累計🐿️:${updatedPoint.totalacorn.toLocaleString()}個 \n${config.nyowacoin}: ${updatedPoint.coin.toLocaleString()}枚 ${nyoboChip.emoji}: ${updatedPoint.nyobo_bank.toLocaleString()}枚`;
      if (idleGameMessagePart) Message += ` ${idleGameMessagePart}`;
      Message += `\nロスアカのどんぐりもお忘れなく……`;

      return interaction.editReply({
        content: Message,
        components: [createLoginResultButtons()],
      });
    } catch (error) {
      console.error("ログボ処理エラー:", error);
      return interaction.editReply("エラーが発生しました。");
    }
    // あまやどんぐりのヘルプを表示するボタン
  } else if (interaction.customId === "show_currency_help") {
    const helpText = `### 雨宿りの通貨について
毎日1回、ログインボーナスとして「あまやどんぐり」をはじめ様々な通貨を受け取る事ができます。
これらの通貨の所持数は、/bank で確認できます。
- **あまやどんぐり**
雑談チャンネルで8時22時の時報についているボタンを押すと毎日1個拾えるログボです
1どんぐり -> 100コインで両替できます。
- **ニョワコイン**
ログボで拾える通貨です${config.nyowacoin}ニョワカジノ(/casino)で遊ぶことができます。1000コイン->1000Mee6経験値に交換もできます。
サーバーブースターは発言時に1-2枚貰えます。（本館と別館のどちらかをブーストで+1、両方で+2)
- **発言レベル(Mee6)**
発言すると上がるお得意様レベルです。現在のレベル・経験値は \`!rank\` と喋れば確認できます。10レベルごとにロールを付与されたり、レガシーピザのログボが増えたりします。
- **ニョボチップ**（旧レガシーピザ）
ログボの受取や雨宿り内で発言をする事で少しずつ手に入るチップです。ルーレットでコインの代わりに賭けたり、放置ゲームで遊ぶのに使えます。
入手したチップはまず銀行に預けられ、/bankで引き出す時に放置ゲーの進捗に応じて入手量が増えます。
- **ひまわり**
リアクションで拾える通貨です。1コイン＋5ニョボバンク貯金というささやかな効果があります。
- **RP(Roleplay Point)**
雨宿りの/ロールプレイコマンドで発言する度に貯まるポイントです。1RP -> 20コインで両替できます。
    `;
    await interaction.reply({
      content: helpText,
      ephemeral: true,
    });
    // --- ここまでが、あまやどんぐりのログインボーナス処理 ---
    // --- ここから下は、ロールプレイ機能の削除ボタン処理 ---
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
