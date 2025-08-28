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
} from "discord.js";
import { Op } from "sequelize";
import { createRpDeleteRequestButton } from "../../components/buttons.mjs";
import { Character, Icon, Point } from "../../models/database.mjs";
import { uploadFile, deleteFile } from "../../utils/supabaseStorage.mjs";
import { sendWebhookAsCharacter } from "../../utils/webhook.mjs";


export const help = {
  category: 'slash',
  // roleplayコマンドは、他のファイルに影響を与えないよう、
  // data.description などを直接参照せず、あえて手で書くことを推奨します。
  description: 'キャラクターになりきって発言できる、ロールプレイ支援機能です。',
  notes: '最大25キャラクターまでセーブデータに保存し、切り替えて使用することができます。',
  subcommands: [
    {
      name: 'register',
      description: 'キャラクターを新規登録、または上書き登録します。',
      notes: '名前、アイコン画像やそのイラストレーター、所属PBWなどを指定して登録します。'
    },
    {
      name: 'post',
      description: '登録したキャラクターとして、メッセージを投稿します。',
      notes: '最後に登録したアイコンが使われます、発言のたびにアップロードして更新する事も可能です。'
    },
    {
      name: 'display',
      description: '登録されているキャラの一覧を確認します。',
      notes: '最後に使われたアイコンや権利表記も確認できます。'
    },
    {
      name: 'delete',
      description: '指定したセーブデータのキャラクターとアイコンを完全に削除します。',
      notes: '削除したデータは元に戻せないので、慎重に操作してください。'
    }
  ]
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
      .setNameLocalizations({
        ja: "キャラ登録",
      })
      .setDescription("ロールプレイをするキャラを登録します。")
      .addStringOption((option) =>
        option
          .setName("chara")
          .setNameLocalizations({
            ja: "キャラ名",
          })
          .setDescription("キャラクター名")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("pbw")
          .setDescription("アイコンの権利表記フォーマット")
          .addChoices(
            {
              name: "ロスト・アーカディア",
              value: "rev2",
            },
            {
              name: "PandoraPartyProject",
              value: "rev1",
            },
            {
              name: "√EDEN",
              value: "tw8",
            },
            {
              name: "チェインパラドクス",
              value: "tw7",
            },
            {
              name: "第六猟兵",
              value: "tw6",
            },
            {
              name: "アルパカコネクト（ワールド名は別途記載）",
              value: "alpaca",
            },
            {
              name: "その他（権利表記は自分で書く）",
              value: "other",
            }
          )
          .setRequired(true)
      )
      .addIntegerOption(
        (option) =>
          option
            .setName("slot")
            .setNameLocalizations({
              ja: "セーブデータ",
            })
            .setDescription("保存するキャラクタースロットを選択（未入力は0)")
            .setAutocomplete(true) // ★★★ これが魔法の呪文 ★★★
      )
      .addAttachmentOption((option) =>
        option
          .setName("icon")
          .setNameLocalizations({
            ja: "アイコン",
          })
          .setDescription("アイコンをアップロードできます")
      )
      .addStringOption((option) =>
        option
          .setName("illustrator")
          .setDescription(
            "投稿アイコンのイラストレーター様(その他選択時は不要)"
          )
      )
      .addStringOption((option) =>
        option
          .setName("world")
          .setNameLocalizations({
            ja: "ワールド",
          })
          .setDescription("【アルパカコネクト社のみ】所属ワールドを入力")
      )
      .addStringOption((option) =>
        option
          .setName("権利表記")
          .setDescription(
            "【その他選択時のみ】権利表記を記載してください。末尾にby（表示名)がつきます。"
          )
      )
  )
  // 発言
  .addSubcommand((subcommand) =>
    subcommand
      .setName("post")
      .setNameLocalizations({
        ja: "発言",
      })
      .setDescription(
        "登録したキャラデータと最後に使用したアイコンでRPします。"
      )
      .addStringOption((option) =>
        option
          .setName("message")
          .setNameLocalizations({
            ja: "内容",
          })
          // 250818 modal 対応のため空欄でも可に
          .setDescription(
            "発言内容(空欄で別途入力欄表示)(改行は\n、<br>、@@@でも可)"
          )
          .setRequired(false)
      )
      .addIntegerOption(
        (option) =>
          option
            .setName("slot")
            .setNameLocalizations({
              ja: "セーブデータ",
            })
            .setDescription("発言するキャラクタースロットを選択（未入力は0)")
            .setRequired(false) // 必須ではなくす（postの場合）
            .setAutocomplete(true) // 250731オートコンプリート形式に変更
      )
      .addAttachmentOption((option) =>
        option
          .setName("icon")
          .setNameLocalizations({
            ja: "アイコン変更",
          })
          .setDescription(
            "アイコンを変更する時はこちら（別ILのアイコンにした時は権利表記オプションもつけること！）"
          )
      )
      .addStringOption((option) =>
        option
          .setName("illustrator")
          .setDescription(
            "（アイコンのILを変えたときのみ）IL名、権利表記を自分で書く時はフルで"
          )
      )
      .addBooleanOption((option) =>
        option
          .setName("nocredit")
          .setNameLocalizations({
            ja: "権利表記省略",
          })
          .setDescription(
            "【非推奨】権利表記を非表示にします、RP中や自作品などに(デフォルトはfalse)"
          )
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
  } else if (subcommand === "post" || subcommand === "delete") {
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
    //登録
    const name = interaction.options.getString("chara");
    const pbw = interaction.options.getString("pbw");
    const slot = interaction.options.getInteger("slot") || 0;
    const icon = interaction.options.getAttachment("icon");
    const world = interaction.options.getString("world");
    const illustrator =
      interaction.options.getString("illustrator") || "絵師様";
    const copyright = interaction.options.getString("権利表記") || "";
    //ファイル名決定
    const charaslot = dataslot(interaction.user.id, slot);
    //権利表記部
    let pbwflag = null;
    if (pbw === "rev1") {
      pbwflag = `『PandoraPartyProject』(c)<@${interaction.user.id}>/illustratorname/Re:version`;
    } else if (pbw === "rev2") {
      pbwflag = `『ロスト・アーカディア』(c)<@${interaction.user.id}>/illustratorname/Re:version`;
    } else if (pbw === "tw6") {
      pbwflag = `『第六猟兵』(c)<@${interaction.user.id}>/illustratorname/トミーウォーカー`;
    } else if (pbw === "tw7") {
      pbwflag = `『チェインパラドクス』(c)<@${interaction.user.id}>/illustratorname/トミーウォーカー`;
    } else if (pbw === "tw8") {
      pbwflag = `『√EDEN』(c)<@${interaction.user.id}>/illustratorname/トミーウォーカー`;
    } else if (pbw === "alpaca") {
      pbwflag = `illustratorname/${world}/(C)アルパカコネクト by <@${interaction.user.id}>`;
    } else if (pbw === "other") {
      pbwflag = `illustratorname by <@${interaction.user.id}>`;
    }

    //アイコン
    let iconUrl = null;
    let deleteHash = null;
    const existingIcon = await Icon.findOne({ where: { userId: charaslot } });
    if (existingIcon?.deleteHash) await deleteFile(existingIcon.deleteHash);

    if (icon) {
      const fetched = await fetch(icon.url);
      const buffer = Buffer.from(await fetched.arrayBuffer());
      //    const result = await uploadToImgur(buffer);
      // サイズチェックを追加
      if (buffer.length > 1024 * 1024) {
        await interaction.reply({
          flags: [4096, 64], //silent,ephemeral
          content: "アイコンファイルのサイズが1MBを超えています。",
        });
        return;
      }

      // 拡張子を取得
      const fileExt = icon.name.split(".").pop();
      if (!["png", "webp", "jpg", "jpeg"].includes(fileExt.toLowerCase())) {
        await interaction.reply({
          flags: [4096, 64], //silent,ephemeral
          content:
            "対応していないファイル形式です。PNG, WebP, JPG のいずれかの形式でアップロードしてください。",
        });
        return;
      }

      const result = await uploadFile(
        buffer,
        interaction.user.id,
        slot,
        fileExt,
        "icons"
      );
      if (result) {
        iconUrl = result.url;
        deleteHash = result.path;
      }
    }

    try {
      await Character.upsert({
        userId: charaslot,
        name: name,
        pbwflag: pbwflag,
      });
      await Icon.upsert({
        userId: charaslot,
        iconUrl,
        illustrator: pbw !== "other" ? illustrator : copyright,
        pbw,
        deleteHash,
      });
      /*
      if (pbw !== "other") {
        await Icon.upsert({
          userId: charaslot,
          iconUrl: iconUrl,
          illustrator: illustrator,
          pbw: pbw,
        });
      } else {
        await Icon.upsert({
          userId: charaslot,
          iconUrl: iconUrl,
          illustrator: copyright,
          pbw: pbw,
        }); //${copyright}が代わりに入る
      }
      */
      const checkchara = await Character.findOne({
        where: {
          userId: charaslot,
        },
      });
      const checkicon = await Icon.findOne({
        where: {
          userId: charaslot,
        },
      });

      console.log("Character Data:", checkchara);
      console.log("Icon Data:", checkicon);
      interaction.reply({
        flags: [4096, 64], //silent,ephemeral
        content: `スロット${slot}にキャラデータを登録しました`,
      });
    } catch (error) {
      console.error("キャラ登録に失敗しました。:", error);
      interaction.reply({
        flags: [4096, 64], //silent,ephemeral
        content: `スロット${slot}へのキャラ登録でエラーが発生しました。`,
      });
    }
  } else if (subcommand === "post") {
    // --- 1. オプションと基本情報の取得 ---

    // スラッシュコマンドでユーザーが入力した各オプションを取得します。
    const slot = interaction.options.getInteger("slot") || 0; // スロット番号。なければ0番。
    const icon = interaction.options.getAttachment("icon"); // 添付されたアイコンファイル。
    const illustrator = interaction.options.getString("illustrator"); // イラストレーター名。
    const message = interaction.options.getString("message"); // 発言内容。
    const nocredit = interaction.options.getBoolean("nocredit"); // 権利表記を省略するかどうか。

    // ユーザーIDとスロット番号から、データベースで使う一意なIDを生成します。
    const charaslot = dataslot(interaction.user.id, slot);

    // --- 2. キャラクターデータの事前読み込み ---

    // この後の処理で必ず使うキャラクター情報を先に読み込みます。
    // try...catchで囲むことで、データベース接続エラーなどでBotが停止するのを防ぎます。
    let loadchara, loadicon;
    try {
      loadchara = await Character.findOne({ where: { userId: charaslot } });
      loadicon = await Icon.findOne({ where: { userId: charaslot } });
    } catch (error) {
      console.error("キャラデータのロードに失敗しました:", error);
      // この時点ではまだ応答を返していないので、.reply()でエラーを伝えます。
      return interaction.reply({
        content:
          "キャラクターデータの読み込み中にエラーが発生しました。しばらくしてからもう一度お試しください。",
        ephemeral: true,
      });
    }

    // 読み込んだキャラクターデータが存在しない場合、処理を中断します。
    if (!loadchara) {
      return interaction.reply({
        content: `スロット${slot}にキャラデータがありません。先に\`/register\`で登録してください。`,
        ephemeral: true,
      });
    }

    // --- 3. 処理の分岐 ---
    // ユーザーの意図に合わせて、3つのパターンに処理を分岐します。

    // 【パターンA: アイコン更新 → Modal表示】
    // `message`オプションが無く、`icon`か`illustrator`オプションが指定されている場合。
    // ユーザーは「先にアイコン周りを更新してから、本文を入力したい」と考えています。
    if (!message && (icon || illustrator)) {
      // ファイルアップロードやDB更新は時間がかかる可能性があるため、まず応答を遅延させます。
      await interaction.deferReply({ ephemeral: true });

      try {
        // ◆ `icon`オプション（新しいアイコンファイル）がある場合の処理 ◆
        if (icon) {
          // 1. DiscordのURLからファイルをフェッチし、Buffer形式（バイナリデータ）に変換します。
          const fetched = await fetch(icon.url);
          const buffer = Buffer.from(await fetched.arrayBuffer());

          // 2. ファイルサイズのチェック（1MB = 1024 * 1024 bytes）
          if (buffer.length > 1024 * 1024) {
            return interaction.editReply({
              content: "アイコンファイルのサイズが1MBを超えています。",
            });
          }

          // 3. ファイル名から拡張子を取得します（例: "image.png" -> "png"）。
          //    安全のためにオプショナルチェイニング(?.)と小文字化(.toLowerCase())を使います。
          const fileExt = icon.name.split(".").pop()?.toLowerCase();

          // 4. 許可された拡張子かどうかをチェックします。
          if (!fileExt || !["png", "webp", "jpg", "jpeg"].includes(fileExt)) {
            return interaction.editReply({
              content:
                "対応していないファイル形式です。PNG, WebP, JPG のいずれかの形式でアップロードしてください。",
            });
          }

          // 5. チェックをすべて通過後、もし古いアイコンがストレージにあれば削除します。
          if (loadicon && loadicon.deleteHash) {
            await deleteFile(loadicon.deleteHash);
          }

          // 6. 新しいアイコンをSupabase Storageなどにアップロードします。
          const result = await uploadFile(
            buffer,
            interaction.user.id,
            slot,
            fileExt,
            "icons"
          );
          if (!result) {
            return interaction.editReply({
              content: "アイコンのアップロードに失敗しました。",
            });
          }

          // 7. データベースの情報を新しいアイコンの情報で更新（または新規作成）します。
          await Icon.upsert({
            userId: charaslot,
            iconUrl: result.url,
            illustrator: illustrator || loadicon.illustrator, // illustrator指定があれば更新、なければ既存のまま
            pbw: loadicon.pbw,
            deleteHash: result.path,
          });

          // ◆ `illustrator`オプションだけがある場合の処理 ◆
        } else if (illustrator) {
          // アイコンファイルは変更せず、イラストレーター名だけを更新します。
          await Icon.upsert({
            userId: charaslot,
            illustrator: illustrator,
          });
        }

        // 8. アイコン処理完了後、Modalを呼び出すためのボタンを作成します。
        //    customIdにスロット番号などの情報を埋め込み、次のインタラクションに引き継ぎます。
        const customId = `show-rp-modal_${slot}_${nocredit || false}`;
        const button = new ButtonBuilder()
          .setCustomId(customId)
          .setLabel("続けてセリフを入力する")
          .setStyle(ButtonStyle.Primary);
        const row = new ActionRowBuilder().addComponents(button);

        // 9. ユーザーに処理完了を知らせ、ボタンを表示します。
        await interaction.editReply({
          content: `**${loadchara.name}**（スロット${slot}）のアイコン情報を更新しました！\nボタンを押してセリフを入力してください。`,
          components: [row],
        });
      } catch (error) {
        console.error("アイコン更新処理中にエラー:", error);
        return interaction.editReply({
          content: "アイコンの更新中に予期せぬエラーが発生しました。",
        });
      }

      // 【パターンB: 即時Modal表示】
      // `message`オプションが無く、アイコン系のオプションも指定されていない場合。
      // ユーザーは「既存のキャラ設定のまま、すぐに長文を入力したい」と考えています。
    } else if (!message) {
      // この処理はDBアクセスもファイルI/Oも無いため非常に高速です。deferは不要です。

      // 1. Modal（ポップアップウィンドウ）を作成します。
      const modal = new ModalBuilder()
        // customIdに情報を埋め込み、どのModalからの送信かを後で識別できるようにします。
        .setCustomId(`roleplay-post-modal_${slot}_${nocredit || false}`)
        .setTitle(`スロット${slot}: ${loadchara.name} で発言`);

      // 2. Modalの中に、複数行のテキスト入力欄を作成します。
      //ここを弄ったらパターンAの時のmodalもbuttonHandler.mjs弄って調整してください
      const messageInput = new TextInputBuilder()
        .setCustomId("messageInput")
        .setLabel("発言内容")
        .setStyle(TextInputStyle.Paragraph) // Paragraphで複数行入力が可能になります。
        .setMaxLength(1750) // ← これを追加！
        .setPlaceholder(
          "ここにセリフを入力してください。（最大1750文字)\n改行もそのまま反映されます。"
        )
        .setRequired(true);

      // 3. 入力欄をModalに追加します。
      const firstActionRow = new ActionRowBuilder().addComponents(messageInput);
      modal.addComponents(firstActionRow);

      // 4. ユーザーにModalを表示します。これでこのインタラクションへの応答は完了です。
      await interaction.showModal(modal);

      // 【パターンC: 従来の直接投稿】
      // `message`オプションが指定されている場合。
      // ユーザーは「短い文章を素早く投稿したい」または「従来通りの使い方をしたい」と考えています。
    } else {
      // Webhookの送信など、少し時間がかかる可能性があるので応答を遅延させます。
      await interaction.deferReply({ flags: 64 });

      try {
        // アイコンの同時更新処理は、ここで行います
        // `icon`か`illustrator`が指定されている場合のみ、更新処理を行う
        if (icon || illustrator) {
          if (icon) {
            // 1. ファイルをフェッチしてBufferに変換
            const fetched = await fetch(icon.url);
            const buffer = Buffer.from(await fetched.arrayBuffer());

            // 2. サイズと拡張子をチェック
            if (buffer.length > 1024 * 1024) {
              return interaction.editReply({
                content: "アイコンファイルのサイズが1MBを超えています。",
              });
            }
            const fileExt = icon.name.split(".").pop()?.toLowerCase();
            if (!fileExt || !["png", "webp", "jpg", "jpeg"].includes(fileExt)) {
              return interaction.editReply({
                content:
                  "対応していないファイル形式です。PNG, WebP, JPG のいずれかの形式でアップロードしてください。",
              });
            }

            // 3. 古いアイコンを削除
            if (loadicon && loadicon.deleteHash) {
              await deleteFile(loadicon.deleteHash);
            }

            // 4. 新しいアイコンをアップロード
            const result = await uploadFile(
              buffer,
              interaction.user.id,
              slot,
              fileExt,
              "icons"
            );
            if (!result) {
              return interaction.editReply({
                content: "アイコンのアップロードに失敗しました。",
              });
            }

            // 5. データベースを更新
            const newIllustrator =
              illustrator || (loadicon ? loadicon.illustrator : "絵師様");
            await Icon.upsert({
              userId: charaslot,
              iconUrl: result.url,
              illustrator: newIllustrator,
              pbw: loadicon ? loadicon.pbw : null,
              deleteHash: result.path,
            });

            // 6. ★★★ 最重要ポイント ★★★
            // DBだけでなく、メモリ上の`loadicon`の情報も、最新の状態に更新します！
            if (!loadicon) {
              // もしアイコンが今まで無かった場合
              loadicon = { userId: charaslot }; // 新しいオブジェクトを作成
            }
            loadicon.iconUrl = result.url;
            loadicon.illustrator = newIllustrator;
          } else if (illustrator) {
            // イラストレーター名だけを更新
            await Icon.upsert({
              userId: charaslot,
              illustrator: illustrator,
            });

            // ★★★ こちらも同様に、メモリ上の情報を更新！ ★★★
            if (loadicon) {
              loadicon.illustrator = illustrator;
            }
          }
        }

        // これで、sendWebhookAsCharacterには、常に最新の情報が渡されます
        const postedMessage = await sendWebhookAsCharacter(
          interaction,
          loadchara,
          loadicon, // ★★★ ここには、更新済みの最新情報が入っている！ ★★★
          message,
          nocredit
        );

        // ★★★ 同じように、ポイント更新と削除ボタンを追加 ★★★
        await updatePoints(interaction.user.id);

      const deleteRequestButtonRow = createRpDeleteRequestButton(
        postedMessage.id,
        interaction.user.id
      );

      await interaction.editReply({
        content: `送信しました。`,
        components: [deleteRequestButtonRow], // ★★★ これを使う ★★★
      });
      } catch (error) {
        console.error("メッセージ送信に失敗しました:", error);
        await interaction.editReply({ content: `エラーが発生しました。` });
      }
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

//発言するたびにポイント+1
export async function updatePoints(userId) {
  try {
    // ユーザーのポイントデータを取得
    const pointEntry = await Point.findOne({
      where: {
        userId: userId,
      },
    });

    if (pointEntry) {
      // ポイントデータが存在する場合、ポイントを更新
      await Point.update(
        {
          point: pointEntry.point + 1,
          totalpoint: pointEntry.totalpoint + 1,
        },
        {
          where: {
            userId: userId,
          },
        }
      );
    } else {
      // ポイントデータが存在しない場合、新規作成
      await Point.create({
        userId: userId,
        point: 1,
        totalpoint: 1,
      });
    }
  } catch (error) {
    console.error("ポイントの更新に失敗しました:", error);
  }
}
