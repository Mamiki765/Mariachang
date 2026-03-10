// commands\slashs\roleplay.mjs
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  LabelBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  FileUploadBuilder,
} from "discord.js";
import { Op } from "sequelize";
import { createRpDeleteRequestButton } from "../../components/buttons.mjs";
import { Character, Icon, Point } from "../../models/database.mjs";
import { deleteFile } from "../../utils/localStorage.mjs";
import { sendWebhookAsCharacter } from "../../utils/webhook.mjs";
import { unlockAchievements } from "../../utils/achievements.mjs";
import config from "../../config.mjs";

// ▼▼▼【連投制限用】ユーザーごとの最終投稿時間を記録するMap ▼▼▼
const lastPostTimestamps = new Map();

export const help = {
  category: "slash",
  // roleplayコマンドは、他のファイルに影響を与えないよう、
  // data.description などを直接参照せず、あえて手で書くことを推奨します。
  description: "キャラクターになりきって発言できる、ロールプレイ支援機能です。",
  notes:
    "最大25キャラクターまでセーブデータに保存し、切り替えて使用することができます。",
  subcommands: [
    {
      name: "register",
      description: "キャラクターを新規登録、または上書き登録します。",
      notes:
        "名前、アイコン画像やそのイラストレーター、所属PBWなどを指定して登録します。",
    },
    {
      name: "post",
      description: "登録したキャラクターとして、メッセージを投稿します。",
      notes: "アイコンは発言のたびにアップロードして更新する事も可能です。",
    },
    {
      name: "post_old",
      description: "登録したキャラクターとして、メッセージを投稿します。(旧式)",
      notes:
        "必ず最後に登録したアイコンが使われ、変更はできません。権利表記の省略のみできます。",
    },
    {
      name: "display",
      description: "登録されているキャラの一覧を確認します。",
      notes: "最後に使われたアイコンや権利表記も確認できます。",
    },
    {
      name: "delete",
      description:
        "指定したセーブデータのキャラクターとアイコンを完全に削除します。",
      notes: "削除したデータは元に戻せないので、慎重に操作してください。",
    },
  ],
};

// キャラ上限数を定数として定義
const MAX_SLOTS = 25;

//  emojisを上限数まで拡張
const emojis = [
  "🍎",
  "🍌",
  "🍉",
  "🍇",
  "🍊",
  "🍓",
  "🥝",
  "🍍",
  "🍑",
  "🍒",
  "🍈",
  "🥥",
  "🥑",
  "🍆",
  "🍅",
  "🌶️",
  "🌽",
  "🥕",
  "🫒",
  "🥦",
  "🥬",
  "🥒",
  "🧄",
  "🧅",
  "🍄",
];

//権利表記の特定部分をIL名で置き換えて権利表記を生成するためのパーツ
const illustratorname = "illustratorname";

export const data = new SlashCommandBuilder()
  .setName("roleplay")
  .setNameLocalizations({
    ja: "ロールプレイ",
  })
  .setDescription("ロールプレイに関する内容")
  // 登録
  .addSubcommand((subcommand) =>
    subcommand
      .setName("register")
      .setNameLocalizations({ ja: "キャラ登録" })
      .setDescription("新しいキャラクターを登録します。")
  )
  // 発言 (新しいモーダル版)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("post")
      .setNameLocalizations({ ja: "発言" })
      .setDescription("登録したキャラクターで発言します。")
  )
  // 旧式の発言 (軽量版)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("post_old")
      .setDescription(
        "【旧式・軽量版】登録キャラとして即座にメッセージを投稿します。"
      )
      .addStringOption((option) =>
        option
          .setName("message")
          .setNameLocalizations({ ja: "内容" })
          .setDescription("発言内容（改行は \\n または <br>）")
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("slot")
          .setNameLocalizations({ ja: "セーブデータ" })
          .setDescription("発言するキャラクタースロットを選択（未入力は0)")
          .setRequired(false)
          .setAutocomplete(true)
      )
      .addBooleanOption((option) =>
        option
          .setName("nocredit")
          .setNameLocalizations({ ja: "権利表記省略" })
          .setDescription("権利表記を非表示にします (デフォルトはfalse)")
          .setRequired(false)
      )
  )
  // 表示
  .addSubcommand((subcommand) =>
    subcommand
      .setName("display")
      .setNameLocalizations({
        ja: "セーブデータ確認",
      })
      .setDescription("登録したキャラデータを表示します。")
      .addIntegerOption(
        (
          option // 250816 5->25キャラに伴い、5キャラ5ページ形式に
        ) =>
          option
            .setName("page")
            .setNameLocalizations({
              ja: "ページ",
            })
            .setDescription("表示を開始するページを選択します。")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(5) // (25 slots / 5 per page)
      )
  )
  // 削除
  .addSubcommand((subcommand) =>
    subcommand
      .setName("delete")
      .setNameLocalizations({
        ja: "キャラ削除",
      })
      .setDescription("登録したキャラデータとアイコンを完全に削除します。")
      .addIntegerOption(
        (option) =>
          option
            .setName("slot")
            .setNameLocalizations({
              ja: "セーブデータ",
            })
            .setDescription("削除するキャラクタースロットを選択")
            .setRequired(true) // 削除には、対象の指定が必須
            .setAutocomplete(true) // もちろん、彼に手伝ってもらう
      )
  );
//オートコンプリートここから
export async function autocomplete(interaction) {
  // まずは、お決まりの準備運動。
  const userId = interaction.user.id;
  const focusedValue = interaction.options.getFocused();
  const subcommand = interaction.options.getSubcommand(false);

  const choices = [];

  // ---ここからが、Supabaseくんを笑顔にする、エレガントなデータ取得方法です---

  // 1. Supabaseに何度も電話する代わりに、まず「買い物リスト」を作ります。
  // これからチェックしたい、全スロットのIDを、一度にまとめてしまいます。
  const potentialSlotIds = [];
  for (let i = 0; i < MAX_SLOTS; i++) {
    potentialSlotIds.push(`${userId}${i > 0 ? `-${i}` : ""}`);
  }

  // 2. 作った「買い物リスト」をSupabaseに一度だけ渡して、
  // 「このリストに載っているキャラクターの情報、全部ください！」と、一括でお願いしてしまいます。
  // これで、25回の通信が、たった1回で済みます。
  const existingCharacters = await Character.findAll({
    where: {
      userId: {
        [Op.in]: potentialSlotIds, // [Op.in]が「このリストの中にあるもの」という意味です。
      },
    },
  });

  // 3. Supabaseから受け取ったキャラクターリストを、
  // スロットIDをキーにして、すぐに見つけられる「地図（Map）」に変換しておきます。
  // これで、この後のループ処理で、もう一度DBに問い合わせる必要がなくなります。
  const characterMap = new Map(
    existingCharacters.map((char) => [char.userId, char])
  );

  // ---これ以降、DBとの通信は一切発生しません。全て手元の「地図」を見て判断します---

  if (subcommand === "register") {
    let firstEmptySlotFound = false;
    for (let i = 0; i < MAX_SLOTS; i++) {
      const charaslotId = potentialSlotIds[i]; // 作成済みのリストからIDを取得。
      const character = characterMap.get(charaslotId); // DBではなく、手元の地図から探します！

      if (character) {
        choices.push({
          name: `${emojis[i]}スロット${i}: ${character.name} に上書き`,
          value: i,
        });
      } else if (!firstEmptySlotFound) {
        choices.push({
          name: `${emojis[i]}スロット${i}: (ここに新しく保存)`,
          value: i,
        });
        firstEmptySlotFound = true;
      }
    }
  } else if (subcommand === "post_old" || subcommand === "delete") {
    // === post と delete 兼用のロジック ===
    for (let i = 0; i < MAX_SLOTS; i++) {
      const charaslotId = potentialSlotIds[i];
      const character = characterMap.get(charaslotId); // こちらも、手元の地図から。
      if (character) {
        choices.push({
          name: `${emojis[i]}スロット${i}: ${character.name}`,
          value: i,
        });
      }
    }
    if (subcommand === "post" && choices.length === 0) {
      choices.push({ name: `${emojis[0]}スロット0: (空のスロット)`, value: 0 });
    }
  }

  // 共通の仕上げ作業は、何も変わりません。
  const filtered = choices.filter((choice) =>
    choice.name.includes(focusedValue)
  );
  const responseChoices =
    filtered.length > 25 ? filtered.slice(0, 25) : filtered;

  await interaction.respond(responseChoices);
}
//オートコンプリートここまで
export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "register") {
    // ==========================================================
    // ▼▼▼ 新しい /roleplay register の処理 ▼▼▼
    // ==========================================================
    try {
      // --- 1. スロット選択肢を動的に生成 ---
      // 以前autocompleteで使っていた効率的なデータ取得ロジックを流用します。
      const userId = interaction.user.id;
      const potentialSlotIds = Array.from(
        { length: MAX_SLOTS },
        (_, i) => `${userId}${i > 0 ? `-${i}` : ""}`
      );

      const existingCharacters = await Character.findAll({
        where: { userId: { [Op.in]: potentialSlotIds } },
      });
      const characterMap = new Map(
        existingCharacters.map((char) => [char.userId, char])
      );

      const slotOptions = [];
      let firstEmptySlotFound = false;
      for (let i = 0; i < MAX_SLOTS; i++) {
        const charaslotId = potentialSlotIds[i];
        const character = characterMap.get(charaslotId);
        const option = new StringSelectMenuOptionBuilder()
          .setValue(String(i)) // modalHandlerで扱いやすいようにslot番号を文字列で渡す
          .setEmoji(emojis[i]);

        if (character) {
          option.setLabel(`スロット${i}: ${character.name} に上書き`);
        } else {
          option.setLabel(`スロット${i}: (ここに新しく保存)`);
          if (!firstEmptySlotFound) {
            option.setDefault(true); // 最初の空きスロットをデフォルト選択にする
            firstEmptySlotFound = true;
          }
        }
        slotOptions.push(option);
      }

      // --- 2. モーダルを構築 ---
      const modal = new ModalBuilder()
        .setCustomId("roleplay-register-modal") // 後でmodalHandlers.mjsで識別するためのID
        .setTitle("キャラクター登録");

      // 【1段目】キャラクター名
      modal.addLabelComponents(
        new LabelBuilder()
          .setLabel("キャラクター名")
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId("register-name-input")
              .setStyle(TextInputStyle.Short)
              .setPlaceholder("神谷 マリア")
              .setRequired(true)
          )
      );

      // 【2段目】所属PBW
      modal.addLabelComponents(
        new LabelBuilder()
          .setLabel("所属PBW (権利表記テンプレート)")
          .setStringSelectMenuComponent(
            new StringSelectMenuBuilder()
              .setCustomId("register-pbw-select")
              .setPlaceholder("選択してください...")
              .addOptions(
                new StringSelectMenuOptionBuilder()
                  .setLabel("ロスト・アーカディア")
                  .setValue("rev2"),
                new StringSelectMenuOptionBuilder()
                  .setLabel("PandoraPartyProject")
                  .setValue("rev1"),
                new StringSelectMenuOptionBuilder()
                  .setLabel("√EDEN")
                  .setValue("tw8"),
                new StringSelectMenuOptionBuilder()
                  .setLabel("チェインパラドクス")
                  .setValue("tw7"),
                new StringSelectMenuOptionBuilder()
                  .setLabel("第六猟兵")
                  .setValue("tw6"),
                new StringSelectMenuOptionBuilder()
                  .setLabel("アルパカコネクト")
                  .setValue("alpaca")
                  .setDescription("イラストレーター名の欄にワールド名も入力"),
                new StringSelectMenuOptionBuilder()
                  .setLabel("その他（権利表記を自分で書く）")
                  .setValue("other")
              )
          )
      );

      // 【3段目】アイコン登録
      modal.addLabelComponents(
        new LabelBuilder()
          .setLabel("アイコン (任意)")
          .setDescription("PNG, WebP, JPGで1MB以内。後からでも変更できます。")
          .setFileUploadComponent(
            new FileUploadBuilder()
              .setCustomId("register-icon-upload")
              .setMaxValues(1)
              .setRequired(false) // 新規登録時はアイコンなしでもOK
          )
      );

      // 【4段目】イラストレーター名
      modal.addLabelComponents(
        new LabelBuilder()
          .setLabel("イラストレーター名 / ワールド名など")
          .setDescription("アルパカの場合は「ワールド名,IL名」のように入力")
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId("register-illustrator-input")
              .setStyle(TextInputStyle.Short)
              .setPlaceholder("絵師様（その他選択時は権利表記全文）")
              .setRequired(false) // 任意項目
          )
      );

      // 【5段目】セーブデータ保存先
      modal.addLabelComponents(
        new LabelBuilder()
          .setLabel("セーブデータ保存先")
          .setStringSelectMenuComponent(
            new StringSelectMenuBuilder()
              .setCustomId("register-slot-select")
              .setPlaceholder("保存するスロットを選択...")
              .addOptions(slotOptions) // 動的に生成した選択肢をセット
          )
      );

      // --- 3. モーダルを表示 ---
      await interaction.showModal(modal);

      // このコマンドの役目はここまで。実際の登録処理は modalHandlers.mjs に引き継がれます。
    } catch (error) {
      console.error("キャラ登録モーダルの表示に失敗しました:", error);
      // showModalで失敗することは稀ですが、念のためエラーハンドリング
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "登録モーダルの表示に失敗しました。",
          ephemeral: true,
        });
      }
    }
  } else if (subcommand === "post") {
    // ==========================================================
    // ▼▼▼ 新しい /roleplay post の処理 (モーダル表示) ▼▼▼
    // ==========================================================
    try {
      // --- 1. 投稿可能なキャラクターリストを作成 ---
      const userId = interaction.user.id;
      const potentialSlotIds = Array.from(
        { length: MAX_SLOTS },
        (_, i) => `${userId}${i > 0 ? `-${i}` : ""}`
      );
      // modalは3秒しか猶予がないのでPromise.all で「キャラ一覧取得」と「ユーザー設定取得」を同時に取得。
      const [existingCharacters, userPointData] = await Promise.all([
        // タスク1: キャラ一覧
        Character.findAll({
          where: { userId: { [Op.in]: potentialSlotIds } },
        }),
        // タスク2: ユーザー設定（最後に使ったスロット）
        Point.findOne({
          where: { userId },
          attributes: ["lastRoleplaySlot", "lastCreditChoice"], // 必要なカラムだけ指定すると更に高速
        }),
      ]);
      // 取得結果を展開
      const characterMap = new Map(
        existingCharacters.map((char) => [char.userId, char])
      );
      const lastUsedSlot = userPointData ? userPointData.lastRoleplaySlot : 0;
      //取得した設定を変数に入れる（なければ'display'）
      const lastCreditChoice = userPointData?.lastCreditChoice || "display";

      const slotOptions = [];
      // defaultFoundフラグを用意して、「最後に使ったキャラ」がいなくなっていた場合の保険をかける
      let isDefaultSet = false;

      //登録済みのキャラのみ選択肢に追加
      for (let i = 0; i < MAX_SLOTS; i++) {
        const character = characterMap.get(potentialSlotIds[i]);
        if (character) {
          const option = new StringSelectMenuOptionBuilder()
            .setValue(String(i))
            .setLabel(`スロット${i}: ${character.name}`)
            .setEmoji(emojis[i]);

          // 最後に使ったキャラがいたらデフォルトをつける
          if (i === lastUsedSlot) {
            option.setDefault(true);
            isDefaultSet = true;
          }

          slotOptions.push(option);
        }
      }

      // もし「最後に使ったスロット」のキャラが削除されていた場合、
      // リストの先頭（スロット番号が一番小さいキャラ）をデフォルトにする
      if (!isDefaultSet && slotOptions.length > 0) {
        slotOptions[0].setDefault(true);
      }

      // --- 2. 投稿できるキャラがいない場合はエラー ---
      if (slotOptions.length === 0) {
        return interaction.reply({
          content:
            "投稿できるキャラクターが登録されていません。\n`/roleplay register` から先にキャラクターを登録してください。",
          ephemeral: true,
        });
      }

      // --- 3. モーダルを構築 ---
      const modal = new ModalBuilder()
        .setCustomId("roleplay-post-modal")
        .setTitle("キャラクター発言");

      modal.addLabelComponents(
        new LabelBuilder()
          .setLabel("キャラクター選択")
          .setStringSelectMenuComponent(
            new StringSelectMenuBuilder()
              .setCustomId("post-slot-select")
              .addOptions(slotOptions)
          )
      );
      modal.addLabelComponents(
        new LabelBuilder()
          .setLabel("発言内容")
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId("post-message-input")
              .setStyle(TextInputStyle.Paragraph)
              .setMaxLength(1750)
              .setRequired(true)
          )
      );
      modal.addLabelComponents(
        new LabelBuilder()
          .setLabel("アイコンの更新 (任意)")
          .setDescription(
            "指定しない場合は、最後に使われたアイコンが使用されます。"
          )
          .setFileUploadComponent(
            new FileUploadBuilder()
              .setCustomId("post-icon-upload")
              .setMaxValues(1)
              .setRequired(false)
          )
      );
      modal.addLabelComponents(
        new LabelBuilder()
          .setLabel("イラストレーター名 (変更時)")
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId("post-illustrator-input")
              .setStyle(TextInputStyle.Short)
              .setMaxLength(64)
              .setRequired(false)
          )
      );
      modal.addLabelComponents(
        new LabelBuilder().setLabel("権利表記").setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId("post-credit-select")
            .addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel("権利表記をする")
                .setValue("display")
                .setDefault(lastCreditChoice === "display"),
              new StringSelectMenuOptionBuilder()
                .setLabel("権利表記をしない")
                .setValue("hide")
                .setDefault(lastCreditChoice === "hide")
            )
        )
      );

      await interaction.showModal(modal);
    } catch (error) {
      console.error("発言モーダルの表示に失敗しました:", error);
      await interaction.reply({
        content: "発言モーダルの表示に失敗しました。",
        ephemeral: true,
      });
    }
  } else if (subcommand === "post_old") {
    // ==========================================================
    // ▼▼▼ 旧式の /roleplay post_old の処理 ▼▼▼
    // ==========================================================
    await interaction.deferReply({ ephemeral: true });
    const message = interaction.options.getString("message"); //先に取得

    // ▼▼▼【連投制限ロジック】ここから追加 ▼▼▼
    const channel = interaction.channel;
    const userId = interaction.user.id;
    const now = Date.now();
    const COOLDOWN = 5000; // 5秒をミリ秒で指定
    const allowed = "1426967790631260272";

    // 1. チャンネルがテキストチャンネル（フォーラムやスレッドではない）かチェック
    // ChannelType.GuildText = 0
    if (
      (channel.type === 0 && channel.id !== allowed) ||
      message.match(config.dominoTriggerRegex)
    ) {
      const lastPost = lastPostTimestamps.get(userId);
      // 2. 前回の投稿記録があり、かつ5秒以内かチェック
      if (lastPost && now - lastPost < COOLDOWN) {
        const remainingTime = Math.ceil((COOLDOWN - (now - lastPost)) / 1000);
        const content = message.match(config.dominoTriggerRegex)
          ? `❌ roleplay_oldでの連続ドミノは制限されています。あと **${remainingTime}秒** お待ちください。`
          : `❌ テキストチャンネルでの連続投稿は制限されています。あと **${remainingTime}秒** お待ちください。\n（スレッドやフォーラムチャンネル、別館のチップ掘りスレでは、この制限なく連続投稿が可能です）`;
        return interaction.editReply({
          content: content,
        });
      }
      // 3. 制限に引っかからなければ、今回の投稿時間を記録
      lastPostTimestamps.set(userId, now);
    }

    //連投チェックここまで

    try {
      const slot = interaction.options.getInteger("slot") || 0;
      const nocredit = interaction.options.getBoolean("nocredit") || false; // 注意: こっちは true で省略
      const charaslot = dataslot(interaction.user.id, slot);

      const loadchara = await Character.findOne({
        where: { userId: charaslot },
      });
      if (!loadchara) {
        return interaction.editReply({
          content: `スロット${slot}にキャラデータがありません。`,
        });
      }
      const loadicon = await Icon.findOne({ where: { userId: charaslot } });

      const postedMessage = await sendWebhookAsCharacter(
        interaction,
        loadchara,
        loadicon,
        message,
        nocredit
      );

      const rewardResult = await updatePoints(
        interaction.user.id,
        interaction.client,
        slot
      );
      const deleteRequestButtonRow = createRpDeleteRequestButton(
        postedMessage.id,
        interaction.user.id
      );

      let replyMessage = "送信しました。";
      if (rewardResult) {
        if (rewardResult.rewardType === "rp") {
          replyMessage += `\n💎 **RP**を1獲得しました！`;
        } else if (rewardResult.rewardType === "pizza") {
          replyMessage += `\n<:nyobochip:1416912717725438013> 連投クールダウン中です。(あと${rewardResult.cooldown}秒)\n代わりに**ニョボチップ**が**${rewardResult.amount.toLocaleString()}**枚、バンクに入金されました。`;
        }
      }

      await interaction.editReply({
        content: replyMessage,
        components: [deleteRequestButtonRow],
      });
    } catch (error) {
      console.error("旧式メッセージ送信に失敗しました:", error);
      await interaction.editReply({ content: `エラーが発生しました。` });
    }
    //ここからセーブデータ表示の処理
  } else if (subcommand === "display") {
    // ephemeralを維持するため、まず応答を遅延させる
    await interaction.deferReply({ flags: 64 });

    const userId = interaction.user.id;
    const itemsPerPage = 5;
    const totalPages = Math.ceil(MAX_SLOTS / itemsPerPage);

    // ★ オプションから開始ページを取得、なければ1ページ目
    let currentPage = interaction.options.getInteger("page") || 1;

    // ★ 表示コンテンツを生成する関数を定義
    const generateDisplay = async (page) => {
      const embeds = [];
      const startSlot = (page - 1) * itemsPerPage;
      const endSlot = startSlot + itemsPerPage;

      // ポイント情報を取得 (一度だけで良いので外に出してもOK)
      const loadpoint = await Point.findOne({ where: { userId } });
      const point = loadpoint ? loadpoint.point : 0;
      const totalpoint = loadpoint ? loadpoint.totalpoint : 0;
      const content = `${interaction.user.username}のキャラクター一覧 RP:${point}(累計:${totalpoint})\n-# アイコンが表示されないときは再度してみてください`;

      for (let i = startSlot; i < endSlot && i < MAX_SLOTS; i++) {
        const charaslot = dataslot(userId, i);
        const loadchara = await Character.findOne({
          where: { userId: charaslot },
        });
        const loadicon = await Icon.findOne({ where: { userId: charaslot } });

        if (!loadchara) {
          embeds.push(
            new EmbedBuilder()
              .setTitle(`${emojis[i]}スロット${i}`)
              .setDescription("キャラは登録されていません。")
          );
        } else {
          const { name, pbwflag } = loadchara;
          let iconUrl = loadicon ? loadicon.iconUrl : null;
          try {
            new URL(iconUrl);
          } catch {
            iconUrl = null;
          }

          const replace = "__" + loadicon.illustrator + "__";
          const copyright = pbwflag.replace(illustratorname, replace);
          const description = `### ${name}\n-# ${copyright}`;

          embeds.push(
            new EmbedBuilder()
              .setColor("#0099ff")
              .setTitle(`${emojis[i]}スロット${i}`)
              .setThumbnail(iconUrl || "https://via.placeholder.com/150")
              .setDescription(
                description + "\n" + (iconUrl || "アイコンが設定されていません")
              )
          );
        }
      }

      // ★ ボタンを作成
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("previous_page")
          .setLabel("◀️ 前へ")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 1), // 1ページ目なら無効
        new ButtonBuilder()
          .setCustomId("next_page")
          .setLabel("次へ ▶️")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === totalPages) // 最終ページなら無効
      );

      return { content, embeds, components: [buttons] };
    };

    // ★ 初回のメッセージを送信
    const initialDisplay = await generateDisplay(currentPage);
    const response = await interaction.editReply(initialDisplay);

    // ★ ボタン操作を待つコレクターを作成
    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === userId, // コマンド実行者のみ反応
      time: 60000, // 60秒でタイムアウト
    });

    collector.on("collect", async (i) => {
      if (i.customId === "previous_page") {
        currentPage--;
      } else if (i.customId === "next_page") {
        currentPage++;
      }
      const newDisplay = await generateDisplay(currentPage);
      await i.update(newDisplay); // ★ ephemeralを維持したままメッセージを更新
    });

    collector.on("end", async () => {
      // タイムアウトしたらボタンを無効化
      const finalDisplay = await generateDisplay(currentPage);
      finalDisplay.components[0].components.forEach((button) =>
        button.setDisabled(true)
      );
      await interaction.editReply(finalDisplay);
    });
    //ここからセーブデータ削除の処理
  } else if (subcommand === "delete") {
    // まずはいつも通り、応答を約束してDiscordを安心させます。
    await interaction.deferReply({ flags: 64 });

    // 削除対象のスロット番号と、それに対応するIDを取得します。
    const slot = interaction.options.getInteger("slot");
    const charaslotId = dataslot(interaction.user.id, slot);

    // DBから、本当にそこにキャラクターの情報があるかを確認します。
    const character = await Character.findOne({
      where: { userId: charaslotId },
    });

    // もしキャラクターがいなければ、ここで処理を終了します。
    if (!character) {
      return interaction.editReply({
        content: `スロット${slot}には、削除するキャラクターが存在しません。`,
      });
    }

    // 1. ユーザーの最終意思を問うための、2つのボタンを作成します。
    const confirmButton = new ButtonBuilder()
      .setCustomId("confirm_delete_character") // 汎用ハンドラと衝突しない、専用のID
      .setLabel("はい、完全に削除します")
      .setStyle(ButtonStyle.Danger); // 破壊的行為には「赤」がふさわしい

    const cancelButton = new ButtonBuilder()
      .setCustomId("cancel_delete_character")
      .setLabel("いいえ、やめておきます")
      .setStyle(ButtonStyle.Secondary); // 安全な選択肢は「グレー」で

    // 2. 作成したボタンを、メッセージの部品として配置します。
    const row = new ActionRowBuilder().addComponents(
      confirmButton,
      cancelButton
    );

    // 3. ユーザーに、最終確認のメッセージを送信します。
    const response = await interaction.editReply({
      content: `**本当に、スロット${slot}の「${character.name}」を削除しますか？**\nこの操作は取り消せません。アイコンファイルも完全に消去されます。`,
      components: [row],
    });

    // 4. この確認メッセージ専用の「個人秘書（Collector）」を雇います。
    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id, // コマンド実行者以外の操作は無視
      time: 30000, // 30秒以内に決断を
    });

    // 5. 秘書は、ボタンが押されるのをじっと待ちます。
    collector.on("collect", async (i) => {
      // 決断が下されたので、まずは応答します。
      await i.deferUpdate();

      if (i.customId === "confirm_delete_character") {
        // 「はい」が押された場合、消去の儀式を執り行います。
        try {
          const icon = await Icon.findOne({ where: { userId: charaslotId } });
          if (icon && icon.deleteHash) {
            await deleteFile(icon.deleteHash);
          }
          if (icon) {
            await Icon.destroy({ where: { userId: charaslotId } });
          }
          await Character.destroy({ where: { userId: charaslotId } });

          // 成功を報告し、ボタンを消します。
          await i.editReply({
            content: `スロット${slot}の「${character.name}」に関する全てのデータを、完全に削除しました。`,
            components: [],
          });
        } catch (error) {
          console.error(`キャラクター削除処理中にエラーが発生:`, error);
          await i.editReply({
            content: "データの削除中に、予期せぬエラーが発生しました。",
            components: [],
          });
        }
      } else if (i.customId === "cancel_delete_character") {
        // 「いいえ」が押された場合、何もせず、ユーザーを安心させます。
        await i.editReply({
          content: "削除はキャンセルされました。",
          components: [],
        });
      }
      collector.stop(); // 仕事が終わったので、秘書は帰ります。
    });

    // 6. タイムアウトした場合の後始末も、秘書の大事な仕事です。
    collector.on("end", async (collected) => {
      // ボタンが一度も押かれずにタイムアウトした場合
      if (collected.size === 0) {
        await interaction.editReply({
          content: "応答がなかったため、削除はキャンセルされました。",
          components: [], // ボタンを消して、操作を確定させます。
        });
      }
    });
  }
}

//サブルーチン
//ロードするデータを選択
function dataslot(id, slot) {
  return slot >= 0 ? `${id}${slot > 0 ? `-${slot}` : ""}` : `${id}`;
}

//発言するたびにポイント+1、最終発言キャラを更新
export async function updatePoints(
  userId,
  client,
  currentSlot = null,
  creditChoice = null
) {
  try {
    const now = new Date();
    const cooldownSeconds = 60;
    const basePizzaAmount = 600;
    const [pointEntry, created] = await Point.findOrCreate({
      where: { userId: userId },
      defaults: {
        point: 0,
        totalpoint: 0,
        lastRoleplaySlot: currentSlot ?? 0,
        lastCreditChoice: creditChoice ?? "display",
      },
    });

    // ▼▼▼【変更点③】更新用データをオブジェクトにまとめる ▼▼▼
    const updateData = {};
    if (currentSlot !== null) {
      updateData.lastRoleplaySlot = currentSlot;
    }
    if (creditChoice !== null) {
      updateData.lastCreditChoice = creditChoice;
    }
    
    // 更新すべきデータがある場合のみDBに書き込む
    if (Object.keys(updateData).length > 0) {
      await pointEntry.update(updateData);
    }
    //スロ番号更新ここまで

    const lastRpDate = pointEntry.lastRpDate;
    // 前回の実行からの経過時間を計算します。初回の場合はInfinity（無限大）とします。
    const secondsSinceLastRp = lastRpDate
      ? (now.getTime() - lastRpDate.getTime()) / 1000
      : Infinity;

    if (secondsSinceLastRp >= cooldownSeconds) {
      // --- クールダウンが終了している、または初回の場合：RPを付与 ---
      //incrementの返り値（更新後のインスタンス）を受け取る
      const updatedPointEntry = await pointEntry.increment([
        "point",
        "totalpoint",
      ]);
      // RPを獲得した「今」の時刻をデータベースに保存します。
      await pointEntry.update({ lastRpDate: now });
      // 更新後のインスタンスから最新の totalpoint を取得する
      const totalPoints = updatedPointEntry.totalpoint;

      const achievementsToCheck = [
        { id: 33, goal: 1 },
        { id: 34, goal: 20 },
        { id: 35, goal: 100 },
        { id: 36, goal: 250 },
        { id: 37, goal: 500 },
      ];

      const idsToUnlock = achievementsToCheck
        .filter((ach) => totalPoints >= ach.goal)
        .map((ach) => ach.id);

      if (idsToUnlock.length > 0) {
        await unlockAchievements(client, userId, ...idsToUnlock);
      }
      return { rewardType: "rp", amount: 1 };
    } else {
      // --- クールダウン中の場合：ニョボチップを「バンク」に付与 ---

      // 入金先を nyobo_bank に変更
      await pointEntry.increment("nyobo_bank", { by: basePizzaAmount });

      const remainingCooldown = Math.ceil(cooldownSeconds - secondsSinceLastRp);

      return {
        rewardType: "pizza",
        amount: basePizzaAmount, // ボーナスのかかっていない基本量
        cooldown: remainingCooldown,
      };
    }
  } catch (error) {
    console.error("ポイントの更新または実績解除処理に失敗しました:", error);
    return null;
  }
}
