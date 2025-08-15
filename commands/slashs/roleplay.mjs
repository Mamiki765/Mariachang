// commands\slashs\roleplay.mjs
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
} from "discord.js";
import { Op } from "sequelize";
import { getWebhookPair } from "../../utils/webhook.mjs";
import { Character, Icon, Point } from "../../models/database.mjs";
import { dominoeffect } from "../utils/domino.mjs";
import { uploadFile, deleteFile } from "../../utils/supabaseStorage.mjs";
import config from "../../config.mjs";

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
          .setDescription("発言内容を記述(改行は\n、<br>、@@@などでもできます)")
          .setRequired(true)
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
  } else if (subcommand === "post") {
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
    if (choices.length === 0) {
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
    let message = interaction.options.getString("message");
    const slot = interaction.options.getInteger("slot") || 0;
    const icon = interaction.options.getAttachment("icon");
    const illustrator = interaction.options.getString("illustrator");
    const nocredit = interaction.options.getBoolean("nocredit");
    let name = null,
      pbwflag = null,
      face = null,
      copyright = null,
      loadchara = null,
      loadicon = null,
      flags = null;
    //ファイル名決定
    const charaslot = dataslot(interaction.user.id, slot);
    await interaction.deferReply({ flags: 64 }); // ★ 250528ここで応答（考え中） ★
    try {
      loadchara = await Character.findOne({
        where: {
          userId: charaslot,
        },
      });
      loadicon = await Icon.findOne({
        where: {
          userId: charaslot,
        },
      });
    } catch (error) {
      console.error("キャラデータのロードに失敗しました:", error);
      interaction.editReply({
        flags: [4096, 64], //silent,ephemeral
        content: `キャラデータのロードでエラーが発生しました。`,
      });
      return;
    }

    if (!loadchara) {
      interaction.editReply({
        flags: [4096, 64], //silent,ephemeral
        content: `スロット${slot}にキャラデータがありません。`,
      });
      return;
    }

    name = loadchara.name;
    pbwflag = loadchara.pbwflag;
    copyright = loadicon.illustrator;
    if (icon) {
      // 古いアイコン削除
      /*
      if (loadicon && loadicon.deleteHash) {
        //       await deleteFromImgur(loadicon.deleteHash);
        await deleteFile(loadicon.deleteHash);
      }
      */
      if (loadicon && loadicon.deleteHash) {
        console.log("削除を試みるファイルパス:", loadicon.deleteHash);
        const deletionResult = await deleteFile(loadicon.deleteHash);
        console.log("削除結果:", deletionResult);
        if (!deletionResult) {
          console.error("古いアイコンの削除に失敗しました！");
        }
      }

      // 新しいアイコンをアップロード
      const fetched = await fetch(icon.url);
      const buffer = Buffer.from(await fetched.arrayBuffer());
      // サイズチェックを追加
      if (buffer.length > 1024 * 1024) {
        await interaction.editReply({
          flags: [4096, 64], //silent,ephemeral
          content: "アイコンファイルのサイズが1MBを超えています。",
        });
        return;
      }

      // 拡張子を取得
      const fileExt = icon.name.split(".").pop();
      if (!["png", "webp", "jpg", "jpeg"].includes(fileExt.toLowerCase())) {
        await interaction.editReply({
          flags: [4096, 64], //silent,ephemeral
          content:
            "対応していないファイル形式です。PNG, WebP, JPG のいずれかの形式でアップロードしてください。",
        });
        return;
      }
      //const result = await uploadToImgur(buffer);
      const result = await uploadFile(
        buffer,
        interaction.user.id,
        slot,
        fileExt,
        "icons"
      );
      if (result) {
        face = result.url;
        const newIconPath = result.path;
        if (illustrator !== null) {
          copyright = illustrator;
        }

        await Icon.upsert({
          userId: charaslot,
          iconUrl: face,
          illustrator: copyright,
          pbw: loadicon.pbw,
          deleteHash: newIconPath,
        });
      } else {
        interaction.editReply({
          flags: [4096, 64], //silent,ephemeral
          content: `アイコンのアップロードでエラーが発生しました。`,
        });
        return;
      }
    } else {
      face = loadicon ? loadicon.iconUrl : null;
    }

    // `illustratorname` が `pbwflag` に含まれているか確認します。
    if (pbwflag.includes(illustratorname)) {
      // `illustratorname` を `copyright` で置き換えます。
      pbwflag = pbwflag.replace(illustratorname, copyright);
    } else {
      // `illustratorname` が含まれていない場合はエラーとして返します。(初期のデータとの互換のため)
      interaction.editReply({
        flags: [4096, 64], //silent,ephemeral
        content: `大変お手数をおかけしますが、再度キャラを登録し直してください`,
      });
      return;
    }

    message = message
      .replace(/@@@/g, "\n")
      .replace(/<br>/g, "\n")
      .replace(/\\n/g, "\n");
    if (!nocredit) {
      message = message + "\n" + `-# ` + pbwflag;
    }

    try {
      // スレッドの場合、Webhookは親チャンネルから取得する
      const webhookTargetChannel = interaction.channel.isThread()
        ? interaction.channel.parent
        : interaction.channel;
      const threadId = interaction.channel.isThread()
        ? interaction.channel.id
        : null;

      // 1. Webhookのペアを取得
      const { hookA, hookB } = await getWebhookPair(webhookTargetChannel);

      // 2. このチャンネル（スレッド含む）の最後のメッセージを1件だけ取得
      const lastMessages = await interaction.channel.messages.fetch({
        limit: 1,
      });
      const lastMessage = lastMessages.first();

      let webhookToUse = hookA; // デフォルトはAを使う

      // 3. 最後の投稿があり、それがWebhookによるものだったら
      if (lastMessage && lastMessage.webhookId) {
        // 4. そのIDがhookAのものだったら、次はBを使う
        if (lastMessage.webhookId === hookA.id) {
          webhookToUse = hookB;
        }
      }

      // 5. 選んだWebhookで送信 (flagsはもう不要！)
      const postmessage = await webhookToUse.send({
        content: message,
        username: name,
        threadId: threadId,
        avatarURL: face,
      });

      //ドミノを振る機能
      if (
        message.match(/(どみの|ドミノ|ﾄﾞﾐﾉ|domino|ドミドミ|どみどみ)/i) ||
        interaction.channel.id === config.dominoch
      ) {
        const user = interaction.member; //DMならuser
        dominoeffect(
          postmessage,
          interaction.client,
          user.id,
          user.user.username,
          name
        );
      }
      // IDに対してポイントの更新処理を追加
      await updatePoints(interaction.user.id);

      await interaction.editReply({
        flags: [4096, 64], //silent,ephemeral
        content: `送信しました`,
      });
      /*
      // 4. 送信された（編集された）メッセージの Message オブジェクトを取得
      const confirmMessage = await interaction.fetchReply();// こうするべきだがエラーが出るので削除
      setTimeout(() => {
        confirmMessage.delete();
      }, 5000);
      */
    } catch (error) {
      console.error("メッセージ送信に失敗しました:", error);
      interaction.editReply({
        flags: [4096, 64], //silent,ephemeral
        content: `エラーが発生しました。`,
      });
    }
    //ここからセーブデータ表示の処理
  } else if (subcommand === "display") {
    // ephemeralを維持するため、まず応答を遅延させる
    await interaction.deferReply({ ephemeral: true });

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
  }
}

//サブルーチン
//ロードするデータを選択
function dataslot(id, slot) {
  return slot >= 0 ? `${id}${slot > 0 ? `-${slot}` : ""}` : `${id}`;
}

//発言するたびにポイント+1
async function updatePoints(userId) {
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
