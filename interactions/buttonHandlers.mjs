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
import { safeDelete } from "../utils/messageutil.mjs";
import { unlockAchievements } from "../utils/achievements.mjs";
import { Point, sequelize, Mee6Level, IdleGame } from "../models/database.mjs";
// 放置ゲームの人口を更新する関数をインポート
import {
  updateUserIdleGame,
  formatNumberReadable,
} from "../utils/idle-game-calculator.mjs";
import { getSupabaseClient } from "../utils/supabaseClient.mjs";
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
      await interaction.deferReply({ ephemeral: true });
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
          // 既にログボを受け取っている時の表示
          // 放置ゲームの人口を取得する、データがなければ0
          const idleGame = await IdleGame.findOne({
            where: { userId: interaction.user.id },
          });
          //ニョワ人口
          const population = idleGame ? Math.floor(idleGame.population) : 0;
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
                boostMessage = `🔥x${multiplier.toFixed(1)} **${hours}時間${minutes}分**`;
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
              `<:nyowamiyarika:1264010111970574408>: ${formatNumberReadable(population)}匹 ${boostMessage}\n` +
              `ロスアカのどんぐりもお忘れなく……`,
            components: [createLoginResultButtons()], // ロスアカへのリンクボタンを追加
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

      // レガシーピザ(ニョボチップ)、ランダム基本給＋ロールに応じたボーナス
      const pizzaConfig = config.loginBonus.legacy_pizza;
      const pizzaMessages = []; // ピザボーナスの内訳メッセージを格納する配列
      const pizzaBreakdown = []; // 合計計算式のための数値を格納する配列
      const nyoboChip = config.casino.currencies.legacy_pizza;
      // 1.基本給
      const basePizza =
        Math.floor(
          Math.random() *
            (pizzaConfig.baseAmount.max - pizzaConfig.baseAmount.min + 1)
        ) + pizzaConfig.baseAmount.min;
      pizzaMessages.push(
        `-# レガシーピザも**${basePizza.toLocaleString()}枚**焼き上がったようです🍕`
      );
      pizzaBreakdown.push(basePizza);

      // 2.Mee6レベル or ロール特典(Lv10ごとに100のものを安全のため併用し高い方を採用)
      let mee6Bonus = 0;
      const mee6Info = await Mee6Level.findOne({
        where: { userId: interaction.user.id },
      });

      let mee6MessagePart = "";
      if (mee6Info) {
        const levelBonus = mee6Info.level * 10;
        const xpProgress = mee6Info.xpInLevel / mee6Info.xpForNextLevel;
        const xpBonus = Math.floor(xpProgress * 10); // 10%ごとに1枚 -> 進捗率(0-1) * 10
        mee6Bonus = levelBonus + xpBonus;

        const xpPercentage = Math.floor(xpProgress * 100);
        mee6MessagePart = `Lv.${mee6Info.level} Exp.${xpPercentage}% = **${mee6Bonus.toLocaleString()}枚**`;
      }

      let roleBonus = 0;
      let winningRoleId = null;
      for (const [roleId, bonusAmount] of Object.entries(
        pizzaConfig.mee6LevelBonuses
      )) {
        if (interaction.member.roles.cache.has(roleId)) {
          if (bonusAmount > roleBonus) {
            roleBonus = bonusAmount;
            winningRoleId = roleId; // IDを更新
          }
        }
      }

      const finalMee6Bonus = Math.max(mee6Bonus, roleBonus);
      if (finalMee6Bonus > 0) {
        let mee6MessageIntro =
          "-# さらに雨宿りでいっぱい喋ったあなたに、ニョワミヤ達がピザを持ってきてくれました🍕";

        if (roleBonus > mee6Bonus && mee6Info) {
          mee6MessagePart += ` (ロール特典により **${roleBonus.toLocaleString()}枚** に増額)`;
        } else if (!mee6Info) {
          // 導入メッセージ自体を、より状況に合ったものに変更する
          mee6MessageIntro =
            "-# さらに雨宿りでいっぱい喋った称号を持つあなたに、ニョワミヤ達がピザを持ってきてくれました🍕";
          mee6MessagePart = `<@&${winningRoleId}>: **${roleBonus.toLocaleString()}枚**`;
        }

        pizzaMessages.push(`${mee6MessageIntro} -> ${mee6MessagePart}`);
        pizzaBreakdown.push(finalMee6Bonus);
      }

      // 3.サーバーブースター
      let boosterBonus = 0; //ブースターでもらえるピザ数
      let boostCount = null; // ★★★ 初期値を null に変更 ★★★

      try {
        const supabase = getSupabaseClient();
        const { count, error } = await supabase
          .from("booster_status")
          .select("*", { count: "exact", head: true })
          .eq("user_id", interaction.user.id);

        if (error) {
          // Supabaseがエラーを返した場合
          console.error("[LoginBonus] Supabase booster count failed:", error);
          // boostCount は null のまま
        } else {
          // 成功した場合は、取得したcountを代入
          boostCount = count;
        }
      } catch (e) {
        // 通信自体に失敗した場合
        console.error("[LoginBonus] Error fetching booster count:", e);
        // boostCount は null のまま
      }

      // --- ここからボーナス計算ロジック ---

      // ▼▼▼ Supabase通信が成功した場合 ▼▼▼
      if (boostCount !== null && boostCount > 0) {
        const boosterConfig = pizzaConfig.boosterBonus;
        boosterBonus =
          boosterConfig.base + boosterConfig.perServer * boostCount;

        pizzaMessages.push(
          `-# さらにサーバーブースターのあなたに感謝を込めて、**${boosterBonus.toLocaleString()}枚** (${boostCount}サーバー分) 追加で焼き上げました🍕`
        );
        pizzaBreakdown.push(boosterBonus);
      }
      // ▼▼▼ Supabase通信に失敗した場合のフォールバック処理 ▼▼▼
      else if (
        boostCount === null &&
        interaction.member.roles.cache.has(pizzaConfig.boosterRoleId)
      ) {
        console.warn(
          `[LoginBonus] Fallback triggered for ${interaction.user.tag}. Using role cache.`
        );
        const boosterConfig = pizzaConfig.boosterBonus;
        // 最低保証として1サーバー分のボーナスを計算
        boosterBonus = boosterConfig.base + boosterConfig.perServer;

        pizzaMessages.push(
          `-# さらにサーバーブースターのあなたに感謝の気持ちを込めて、**${boosterBonus.toLocaleString()}枚**追加で焼き上げました🍕 (DB接続失敗時の最低保証)`
        );
        pizzaBreakdown.push(boosterBonus);
      }

      // 4.放置ゲームの人口ボーナス
      // 新しい関数を呼び出して、人口を更新＆ボーナスを取得
      const idleResult = await updateUserIdleGame(interaction.user.id);

      if (idleResult && idleResult.pizzaBonusPercentage > 0) {
        // もし放置ゲームをプレイしていて、ボーナスがあるなら...

        // ★★★ (678 + 600 + 1000) x 1.0512 みたいに... ★★★
        // 今までの合計値(totalPizza)に、パーセントボーナスを掛ける！
        const populationBonusMultiplier =
          1 + idleResult.pizzaBonusPercentage / 100;
        const pizzaBeforeBonus = pizzaBreakdown.reduce(
          (sum, val) => sum + val,
          0
        );
        const bonusAmount = Math.floor(
          pizzaBeforeBonus * (populationBonusMultiplier - 1)
        );

        pizzaMessages.push(
          `-# ${nyoboChip.displayName}に換金します……ボーナス **${bonusAmount.toLocaleString()}枚**(**+${idleResult.pizzaBonusPercentage.toFixed(3)}%**)`
        );
        pizzaBreakdown.push(bonusAmount);
      } else {
        // もし放置ゲームをプレイしていないなら...
        pizzaMessages.push(
          `-# ${nyoboChip.displayName}に換金します……【PR】拾った${nyoboChip.displayName}を/放置ゲーム(/idle)で使えるようになりました。${nyoboChip.emoji}`
        );
      }

      // 合計の計算と最終メッセージの構築
      const totalPizza = pizzaBreakdown.reduce((sum, val) => sum + val, 0);
      Message += `\n${pizzaMessages.join("\n")}`; // \n\nで少し間を空ける
      Message += `\n**${pizzaBreakdown.join(" + ")} = 合計 ${totalPizza.toLocaleString()}枚の${nyoboChip.displayName}を受け取りました！**`;

      updateData.legacy_pizza = sequelize.literal(
        `legacy_pizza + ${totalPizza}`
      );
      // ▲▲▲ 新ピザメッセージ構築ロジックここまで ▲▲▲
      // 6. データベースを更新
      await pointEntry.update(updateData);
      // update()は更新内容を返さないため、reload()で最新の状態を取得します。
      const updatedPointEntry = await pointEntry.reload();

      // どんぐり数実績
      const acornChecks = [
        { id: 23, condition: updatedPointEntry.totalacorn >= 1 },
        { id: 24, condition: updatedPointEntry.totalacorn >= 10 },
        { id: 25, condition: updatedPointEntry.totalacorn >= 30 },
        { id: 26, condition: updatedPointEntry.totalacorn >= 50 },
        { id: 27, condition: updatedPointEntry.totalacorn >= 100 },
      ];
      const idsToCheck = acornChecks.filter(p => p.condition).map(p => p.id);
      await unlockAchievements(interaction.client, interaction.user.id, ...idsToCheck);
      
      // 7. ユーザーに成功を報告するメッセージを作成
      // 区切り線
      Message += `\n--------------------`;
      // 所持数、累計数、コイン、レガシーピザの表示、ロスアカのログボ受取をリマインド
      Message += `\n所持🐿️: ${updatedPointEntry.acorn.toLocaleString()}個 累計🐿️:${updatedPointEntry.totalacorn.toLocaleString()}個 \n${config.nyowacoin}: ${updatedPointEntry.coin.toLocaleString()}枚 ${config.casino.currencies.legacy_pizza.emoji}: ${updatedPointEntry.legacy_pizza.toLocaleString()}枚`;
      if (idleResult) {
        //放置ゲーの人口及びブースト表示
        // 人口表示
        Message += ` <:nyowamiyarika:1264010111970574408>: ${formatNumberReadable(Math.floor(idleResult.population))}匹`;
        // ブースト表示
        if (idleResult.buffRemaining) {
          const { hours, minutes } = idleResult.buffRemaining;
          if (hours > 0 || minutes > 0) {
            Message += ` 🔥x${idleResult.currentBuffMultiplier.toFixed(1)} **${hours}時間${minutes}分**`;
          } else {
            Message += ` 🔥ブーストなし /idleで点火できます。`;
          }
        } else {
          // バフ情報自体がない場合も
          Message += ` 🔥ブーストなし /idleで点火できます。`;
        }
      }
      Message += `\nロスアカのどんぐりもお忘れなく……`;
      // 8. ユーザーに返信
      return interaction.editReply({
        content: Message,
        components: [createLoginResultButtons()], // ロスアカへのリンクボタンを追加
      });
    } catch (error) {
      console.error("ログインボーナスの処理中にエラーが発生しました:", error);
      return interaction.editReply({
        content: "エラーが発生しました。どんぐりを拾えなかったようです…。",
        ephemeral: true,
      });
    }
    // あまやどんぐりのヘルプを表示するボタン
  } else if (interaction.customId === "show_currency_help") {
    const helpText = `### 雨宿りの通貨について
毎日1回、ログインボーナスとして「あまやどんぐり」をはじめ様々な通貨を受け取る事ができます。
これらの通貨の所持数は、/casino balance で確認できます。
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
放置ゲーの進捗で入手量が少しだけ増えます。
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

    // ====================================================================
    // ★★★ ここからが、Mee6 XP交換の「第二段階」ロジック ★★★
    // ====================================================================
  } else if (interaction.customId === "confirm_exchange_coin_to_xp") {
    const cost = 1000;
    const mee6RoleId = "1413916213532295345";
    const userId = interaction.user.id;

    // 「処理中...」というメッセージで応答を更新し、確認ボタンを無効化する
    await interaction.update({
      content: "処理中です。しばらくお待ちください...",
      components: [], // ボタンを消す
    });

    const t = await sequelize.transaction();
    try {
      const userPoint = await Point.findOne({
        where: { userId },
        transaction: t,
      });
      if (!userPoint || userPoint.coin < cost) {
        throw new Error(
          `コインが足りません！ (必要: ${cost} / 所持: ${userPoint?.coin || 0})`
        );
      }

      // 1. コインを引く
      userPoint.coin -= cost;

      // 2. Discordにロールを付与
      await interaction.member.roles.add(mee6RoleId);

      // 3. DB変更を保存
      await userPoint.save({ transaction: t });

      // 4. トランザクションをコミット
      await t.commit();

      // 5. ユーザーに成功を報告
      await interaction.followUp({
        content: `✅ **両替成功！**\n${config.nyowacoin}**${cost}枚**を **Mee6経験値${cost}** に変換しました！\nMee6が経験値を付与するまで、少しお待ちください。`,
        ephemeral: true,
      });
    } catch (error) {
      await t.rollback();
      console.error("Mee6 XP交換エラー:", error);

      // エラーメッセージを組み立てる
      let errorMessage = "処理に失敗しました。";
      if (error.message.includes("コインが足りません")) {
        errorMessage = error.message; // ユーザーに分かりやすいエラーメッセージをそのまま表示
      } else if (error.code === 50013) {
        // Missing Permissions エラーコード
        errorMessage =
          "Botの権限不足により、ロールを付与できませんでした。管理者に連絡してください。";
        console.error(
          `[Mee6 Exchange Error] Missing Permissions: ユーザーID ${userId}, サーバーID ${interaction.guildId}`
        );
      }

      await interaction.followUp({
        content: `❌ **エラー**\n${errorMessage}`,
        ephemeral: true,
      });
    }
  } else if (interaction.customId === "cancel_exchange") {
    await interaction.update({
      content: "交換をキャンセルしました。",
      components: [],
    });
  } else {
    //ボタンが不明のとき
    return;
  }
}
