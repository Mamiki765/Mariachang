//interactions\modalHandlers.mjs
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import config from "../config.mjs";
import {
  replytoDM,
  replyfromDM,
  createRpDeleteRequestButton,
} from "../components/buttons.mjs";
//RP機能周りimport
import { sendWebhookAsCharacter } from "../utils/webhook.mjs";
import { Character, Icon,sequelize } from "../models/database.mjs";
import { updatePoints } from "../commands/slashs/roleplay.mjs"; // updatePointsをインポート
import { uploadFile, deleteFile } from "../utils/supabaseStorage.mjs";
//RP周りここまで

export default async function handleModalInteraction(interaction) {
  //モーダル
  //DMやり取り系
  const DMregex = /^admin_replytoDM_submit-(\d+)$/;
  const DMmatch = interaction.customId.match(DMregex);

  //管理人室とやりとり（ユーザー→モデレーター)
  if (interaction.customId == "admin_replyfromDM_submit") {
    const content = interaction.fields.getTextInputValue("message");
    try {
      //管理人からのメッセージを取得
      if (!interaction.message.embeds[0]) {
        await interaction.message.fetch();
      }
      const component = replytoDM(interaction.user.id);
      //管理人室に返信
      await interaction.client.channels.cache.get(config.logch.admin).send({
        embeds: [
          new EmbedBuilder()
            .setTitle("DMの返信がありました")
            .setColor("#FFD700")
            .setDescription(`送信内容\`\`\`\n${content}\n\`\`\``)
            .setThumbnail(
              interaction.user.displayAvatarURL({
                dynamic: true,
              })
            )
            .setTimestamp()
            .addFields(
              {
                name: "送信者",
                value: `${interaction.user.displayName}(ID:${interaction.user.id})`,
              },
              {
                name: "返信されたメッセージ",
                value: interaction.message.embeds[0].description,
              }
            ),
        ],
        components: [component],
      });
      // ボタンを消す
      const disabledButton = new ButtonBuilder()
        .setCustomId("siyoudumi")
        .setLabel("送信しました")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);
      const newRow = new ActionRowBuilder().addComponents(disabledButton);
      await interaction.message.edit({
        components: [newRow],
      });
      //送信内容をここに表示
      await interaction.user.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("管理人室への返信")
            .setColor("#B78CFE")
            .setDescription(`\`\`\`\n${content}\n\`\`\``)
            .setTimestamp(),
        ],
      });
      //完了報告
      await interaction.reply({
        flags: 64, //ephemeral
        content: `返信を送信しました。`,
      });
    } catch (e) {
      console.error("メッセージ送信に失敗しました:", e);
      await interaction.reply({
        flags: 64, //ephemeral
        content: `メッセージの送信に失敗しました: ${e.message}`,
      });
    }
    //管理人室→ユーザー　送信処理
  } else if (DMmatch) {
    const content = interaction.fields.getTextInputValue("message");
    const replyable = interaction.fields.getTextInputValue("replyable");
    const user = await interaction.client.users
      .fetch(DMmatch[1])
      .catch(() => null);
    if (!user) {
      return interaction.reply({
        content:
          "エラー: 返信先のユーザーが見つかりませんでした。すでにサーバーを抜けているか、アカウントが削除された可能性があります。",
        ephemeral: true,
      });
    }
    if (!interaction.message.embeds[0]) {
      await interaction.message.fetch();
    }
    const replybutton = replyable === "0" ? null : [replyfromDM];
    try {
      const embed = new EmbedBuilder()
        .setTitle(`管理人室からのメッセージ`)
        .setDescription(content)
        .setTimestamp()
        .setColor("#FFD700")
        .setFooter({
          text: "このダイレクトメールへの書き込みには返信できません、ご了承ください",
        });
      // メッセージを指定されたチャンネルに送信
      await user.send({
        embeds: [embed],
        components: replybutton,
      });
      await interaction.client.channels.cache.get(config.logch.admin).send({
        embeds: [
          new EmbedBuilder()
            .setTitle("管理者発言ログ(DM)")
            .setColor("#FFD700")
            .setDescription(`送信内容\`\`\`\n${content}\n\`\`\``)
            .setThumbnail(
              interaction.user.displayAvatarURL({
                dynamic: true,
              })
            )
            .setTimestamp()
            .addFields(
              {
                name: "送信者",
                value: `${interaction.member.displayName}(ID:${interaction.user.id})`,
              },
              {
                name: "送信相手",
                value: `\@${user.username} (<@${user.id}>)`,
              },
              {
                name: "返信されたメッセージ",
                value: interaction.message.embeds[0].description,
              },
              {
                name: "返信可否",
                value: `${replyable}`,
              }
            ),
        ],
      });
      await interaction.reply({
        flags: 64, //ephemeral
        content: `${user.username}にメッセージを送信しました。\n送信内容\`\`\`\n${content}\n\`\`\``,
      });
    } catch (e) {
      console.error("メッセージ送信に失敗しました:", e);
      await interaction.reply({
        flags: 64, //ephemeral
        content: `メッセージの送信に失敗しました: ${e.message}`,
      });
    }
  } else if (interaction.customId.startsWith("roleplay-post-modal_")) {
    // このモーダルからの送信には少し時間がかかるので、応答を遅延させます。
    await interaction.deferReply({ ephemeral: true });

    try {
      // 1. customIdからスロット番号とnocreditフラグを解析します。
      const parts = interaction.customId.split("_");
      const slot = parseInt(parts[1], 10);
      const nocredit = parts[2] === "true";

      // 2. モーダルの入力欄からメッセージ内容を取得します。
      const message = interaction.fields.getTextInputValue("messageInput");

      // 3. データベースからキャラクター情報を読み込みます。
      const charaslot = `${interaction.user.id}${slot > 0 ? `-${slot}` : ""}`;
      const loadchara = await Character.findOne({
        where: { userId: charaslot },
      });
      const loadicon = await Icon.findOne({ where: { userId: charaslot } });

      if (!loadchara) {
        return interaction.editReply({
          content: `エラー：スロット${slot}のキャラクターが見つかりませんでした。`,
        });
      }

      const postedMessage = await sendWebhookAsCharacter(
        interaction,
        loadchara,
        loadicon,
        message,
        nocredit
      );
      const rewardResult = await updatePoints(
        interaction.user.id,
        interaction.client
      );

      const deleteRequestButtonRow = createRpDeleteRequestButton(
        postedMessage.id,
        interaction.user.id
      );
      let replyMessage = "送信しました。";
      if (rewardResult) {
        if (rewardResult.rewardType === "rp") {
          // 実際の絵文字IDなどに合わせて変更してください
          replyMessage += `\n💎 **RP**を1獲得しました！`;
        } else if (rewardResult.rewardType === "pizza") {
          replyMessage += `\n<:nyobochip:1416912717725438013> 連投クールダウン中です。(あと${rewardResult.cooldown}秒)\n代わりに**ニョボチップ**が**${rewardResult.amount.toLocaleString()}**枚、バンクに入金されました。`;
        }
      }
      await interaction.editReply({
        content: replyMessage,
        components: [deleteRequestButtonRow], // ★★★ これを使う ★★★
      });
    } catch (error) {
      console.error("Modalからのメッセージ送信に失敗しました:", error);
      await interaction.editReply({ content: `エラーが発生しました。` });
    }
  } else if (interaction.customId === "roleplay-register-modal") {
    await handleRoleplayRegisterModal(interaction);
  } else {
    //モーダルが不明のとき
    return;
  }
}

/**
 * "all", "half", "数値" の文字列を解釈して、処理すべき数値を返すヘルパー関数
 * @param {string} amountStr - ユーザーが入力した文字列
 * @param {number} currentBalance - その時点でのユーザーの所持量
 * @returns {number} 計算された数値
 */
function parseAmount(amountStr, currentBalance) {
  const lowerCaseStr = amountStr.toLowerCase().trim();
  let amount;

  if (lowerCaseStr === "all") {
    amount = currentBalance;
  } else if (lowerCaseStr === "half") {
    amount = Math.floor(currentBalance / 2);
  } else {
    amount = parseInt(lowerCaseStr, 10);
    if (isNaN(amount) || amount <= 0) {
      throw new Error("有効な数値を入力してください。");
    }
    if (amount > currentBalance) {
      throw new Error(
        `所持している量が足りません！(所持: ${currentBalance.toLocaleString()})`
      );
    }
  }

  if (amount <= 0) {
    throw new Error("両替/引き出し額が0です。");
  }
  return amount;
}

// ==========================================================
// ▼▼▼ RP登録モーダル処理用の専用関数 ▼▼▼
// ==========================================================
/**
 * /roleplay register のモーダル送信を処理します
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handleRoleplayRegisterModal(interaction) {
  // ファイル処理やDBアクセスには時間がかかるため、応答を遅延させます
  await interaction.deferReply({ ephemeral: true });

  try {
    // --- 1. モーダルから各コンポーネントの値を取得 ---
    const name = interaction.fields.getTextInputValue("register-name-input");
    const pbw = interaction.fields.getStringSelectValues(
      "register-pbw-select"
    )[0];
    const illustratorInput = interaction.fields.getTextInputValue(
      "register-illustrator-input"
    );
    const slot = parseInt(
      interaction.fields.getStringSelectValues("register-slot-select")[0],
      10
    );
    const files = interaction.fields.getUploadedFiles("register-icon-upload");

    const charaslot = `${interaction.user.id}${slot > 0 ? `-${slot}` : ""}`;

    // --- 2. 権利表記(pbwflag)を生成 ---
    let illustrator = illustratorInput || "絵師様";
    let copyright = illustratorInput || "";
    let world = null;

    if (pbw === "alpaca") {
      if (!illustratorInput || !illustratorInput.includes(",")) {
        // カンマがない、または入力自体が空の場合はエラーを投げて処理を中断
        throw new Error(
          "アルパカコネクトを選択した場合、イラストレーター名の欄に「ワールド名, イラストレーター名」の形式で入力してください。"
        );
      }
      // 検証をパスした場合、ワールド名とIL名を分離
      [world, illustrator] = illustratorInput.split(",").map((s) => s.trim());
    }

    let pbwflag = null;
    // ... (権利表記のif-else if文、内容は前回のものと同じ)
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
      pbwflag = `illustratorname/${world || "（ワールド名未設定）"}/(C)アルパカコネクト by <@${interaction.user.id}>`;
    } else if (pbw === "other") {
      pbwflag = `illustratorname by <@${interaction.user.id}>`;
    }

    // --- 3. アイコンファイルの処理 ---
    let iconUrl = null;
    let deleteHash = null;

    const existingIcon = await Icon.findOne({ where: { userId: charaslot } });
    if (existingIcon?.deleteHash) {
      await deleteFile(existingIcon.deleteHash);
    }

    if (files && files.size > 0) {
      const icon = files.first();
      const fetched = await fetch(icon.url);
      const buffer = Buffer.from(await fetched.arrayBuffer());

      if (buffer.length > 1024 * 1024)
        throw new Error("アイコンファイルのサイズが1MBを超えています。");

      const fileExt = icon.name.split(".").pop()?.toLowerCase();
      if (!["png", "webp", "jpg", "jpeg"].includes(fileExt))
        throw new Error(
          "対応していないファイル形式です。PNG, WebP, JPG のいずれかでアップロードしてください。"
        );

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
      } else {
        throw new Error("アイコンのアップロードに失敗しました。");
      }
    }

    // --- 4. データベースにトランザクションで保存 ---
    await sequelize.transaction(async (t) => {
      // Characterテーブルへの書き込み
      await Character.upsert(
        {
          userId: charaslot,
          name: name,
          pbwflag: pbwflag,
        },
        { transaction: t }
      );

      // Iconテーブルへの書き込み
      await Icon.upsert(
        {
          userId: charaslot,
          iconUrl,
          // illustratorとcopyrightのどちらを使うかはpbwの値による
          illustrator: pbw !== "other" ? illustrator : copyright,
          pbw,
          deleteHash,
        },
        { transaction: t }
      );
    });

    // --- 5. ユーザーに成功を通知 ---
    await interaction.editReply({
      content: `✅ 登録完了！\nスロット${slot}に **${name}** を登録しました。`,
    });
  } catch (error) {
    console.error("キャラクター登録処理でエラー:", error);
    await interaction.editReply({
      content: `❌ エラーが発生しました。\n${error.message}`,
    });
  }
}

// ==========================================================
// ▼▼▼ RP投稿モーダル処理用の専用関数 (将来の実装用) ▼▼▼
// ==========================================================
/**
 * /roleplay post のモーダル送信を処理します
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handleRoleplayPostModal(interaction) {
  // ここに /roleplay post 用のモーダル処理を実装します
}
