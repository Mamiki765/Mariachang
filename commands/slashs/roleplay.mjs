import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getWebhookInChannel, getWebhook } from "../../utils/webhook.mjs";
import { Character, Icon, Point } from "../../models/database.mjs";
import { dominoeffect } from "../utils/domino.mjs";
//import { uploadToImgur, deleteFromImgur } from "../../utils/imgur.mjs";
import { uploadFile, deleteFile } from "../../utils/supabaseStorage.mjs";
import config from "../../config.mjs";

//絵文字　スロットの数に合わせる
const emojis = ["🍎", "🍌", "🍉", "🍇", "🍊"];
/*オートコンプリート式にしたので削除250731
const slotChoices = emojis.map((emoji, index) => ({
  name:
    index === 0
      ? `${emoji}スロット${index}(デフォルト)`
      : `${emoji}スロット${index}`,
  value: index,
}));
*/

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
  );
//オートコンプリートここから
export async function autocomplete(interaction) {
  // まず、誰からのリクエストかを取得する
  const userId = interaction.user.id;
  // 現在入力中の値を取得する
  const focusedValue = interaction.options.getFocused();

  const choices = [];
  // 0から4までのスロットをループ
  for (let i = 0; i < 5; i++) {
    const charaslotId = `${userId}${i > 0 ? `-${i}` : ""}`;

    // DBから、そのスロットのキャラクター情報を探す
    const character = await Character.findOne({
      where: { userId: charaslotId },
    });

    let name;
    if (character) {
      // キャラがいれば、「絵文字 スロット番号: キャラ名」という形式に
      name = `${emojis[i]}スロット${i}: ${character.name}`;
    } else {
      // キャラがいなければ、「(空のスロット)」と表示
      name = `${emojis[i]}スロット${i}: (空のスロット)`;
    }

    // valueには、今まで通り「0」「1」のようなスロット番号を入れる
    choices.push({ name: name, value: i });
  }

  // 入力された文字で絞り込む（もしユーザーが何か入力していた場合）
  const filtered = choices.filter((choice) =>
    choice.name.includes(focusedValue)
  );

  // 絞り込んだ結果を、Discordに返す
  await interaction.respond(filtered);
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
      let webhook = null;
      let Threadid = null;
      if (!interaction.channel.isThread()) {
        webhook = await getWebhookInChannel(interaction.channel);
      } else {
        webhook = await getWebhookInChannel(interaction.channel.parent);
        Threadid = interaction.channel.id;
      }

      //連投確認
      const messages = await interaction.channel.messages.fetch({
        limit: 2,
      });
      const lastMessage = messages.first();
      if (lastMessage) {
        const now = Date.now();
        const lastMessageTime = lastMessage.createdTimestamp;
        const isRecent = now - lastMessageTime <= 10 * 60 * 1000; // 10分以内
        const isWebhook = lastMessage.webhookId != null;
        const isSilent = lastMessage.flags.has(4096); // 4096はサイレントメッセージのフラグ

        if (isRecent && isWebhook && !isSilent) {
          flags = [4096];
        }
      }

      const postmessage = await webhook.send({
        content: message,
        username: name,
        threadId: Threadid,
        avatarURL: face,
        flags: flags,
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
  } else if (subcommand === "display") {
    try {
      const embeds = [];
      const loadpoint = await Point.findOne({
        where: {
          userId: interaction.user.id,
        },
      });
      const point = loadpoint ? loadpoint.point : 0;
      const totalpoint = loadpoint ? loadpoint.totalpoint : 0;

      for (let i = 0; i < emojis.length; i++) {
        //ファイル名決定
        const charaslot = dataslot(interaction.user.id, i);

        const loadchara = await Character.findOne({
          where: {
            userId: charaslot,
          },
        });
        const loadicon = await Icon.findOne({
          where: {
            userId: charaslot,
          },
        });

        if (!loadchara) {
          const embed = new EmbedBuilder()
            .setTitle(`スロット${i}`)
            .setDescription("キャラは登録されていません。");
          embeds.push(embed);
        } else {
          const { name, pbwflag } = loadchara;

          let iconUrl = loadicon ? loadicon.iconUrl : null;
          //let icondeleteHash = loadicon ? loadicon.deleteHash : null;//deletehashテスト

          // URLの検証
          try {
            new URL(iconUrl);
          } catch (error) {
            iconUrl = null; // 無効なURLの場合はnullにする
          }

          const replace = "__" + loadicon.illustrator + "__";
          const copyright = pbwflag.replace(illustratorname, replace);
          const description = `### ${name}\n-# ${copyright}`;

          const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle(`${emojis[i]}スロット${i}`)
            .setThumbnail(iconUrl || "https://via.placeholder.com/150")
            .setDescription(
              description + "\n" + iconUrl || "キャラが設定されていません"
            );

          embeds.push(embed);
        }
      }
      await interaction.reply({
        content: `${interaction.user.username}のキャラクター一覧 RP:${point}(累計:${totalpoint})\n-# アイコンが表示されないときは再度してみてください`,
        embeds: embeds,
        flags: 64, //ephemeral
      });
    } catch (error) {
      console.error("キャラデータの表示に失敗しました:", error);
      await interaction.reply({
        flags: [4096, 64], //silent,ephemeral
        content: `キャラデータの表示でエラーが発生しました。`,
      });
    }
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
