// commands/slashs/sticker.mjs
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { Sticker } from "../../models/roleplay.mjs"; // あなたのデータベース設定からStickerモデルをインポート
import { uploadFile, deleteFile, getDirectorySize } from "../../utils/supabaseStorage.mjs"; // 汎用化したストレージ管理モジュール
import { Op } from "sequelize"; // Sequelizeの「OR」検索などを使うためにインポート
import fetch from "node-fetch";
import sizeOf from "image-size";
import config from "../../config.mjs";
// スタンプの登録、投稿、削除を行うスラッシュコマンド
// --- 1. コマンドの「設計図」を定義します ---
export const data = new SlashCommandBuilder()
  .setName("sticker")
  .setDescription("カスタムスタンプ機能")

  // 登録サブコマンド
  .addSubcommand((subcommand) =>
    subcommand
      .setName("register")
      .setDescription("新しいスタンプを登録します。")
      .addAttachmentOption((option) =>
        option
          .setName("image")
          .setDescription("スタンプにする画像 (320x320、512KBまで)")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("name")
          .setDescription("スタンプの名前 (オートコンプリートで検索されます)")
          .setRequired(true)
      )
      .addBooleanOption((option) =>
        option
          .setName("public")
          .setDescription(
            "他の人も使えるように公開しますか？ (※PBW納品物はライセンス品のみ公開してください！)"
          )
      )
  )

  // 投稿サブコマンド
  .addSubcommand((subcommand) =>
    subcommand
      .setName("post")
      .setDescription("スタンプを投稿します。")
      .addStringOption((option) =>
        option
          .setName("name")
          .setDescription("投稿したいスタンプの名前")
          .setRequired(true)
          .setAutocomplete(true)
      )
  )

  // 削除サブコマンド
  .addSubcommand((subcommand) =>
    subcommand
      .setName("delete")
      .setDescription("あなたが登録したスタンプを削除します。")
      .addStringOption((option) =>
        option
          .setName("name")
          .setDescription("削除したいスタンプの名前")
          .setRequired(true)
          .setAutocomplete(true)
      )
  );

// --- 2. オートコンプリートの処理を定義します ---
export async function autocomplete(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const focusedValue = interaction.options.getFocused();
  const userId = interaction.user.id;

  let whereClause = {};

  if (subcommand === "post") {
    // 【postの場合】自分がオーナー、または公開されているスタンプ
    whereClause = {
      [Op.or]: [{ ownerId: userId }, { isPublic: true }],
      name: { [Op.like]: `${focusedValue}%` },
    };
  } else if (subcommand === "delete") {
    // 【deleteの場合】自分がオーナーのスタンプのみ
    whereClause = {
      ownerId: userId,
      name: { [Op.like]: `${focusedValue}%` },
    };
  }

  const choices = await Sticker.findAll({
    where: whereClause,
    limit: 25,
    order: [["name", "ASC"]], // 名前順にソートすると見やすい
  });

  await interaction.respond(
    choices.map((choice) => ({
      name: `[${choice.isPublic ? "公開" : "個人"}] ${choice.name}`,
      value: choice.name,
    }))
  );
}

// --- 3. 実際にコマンドが実行されたときの処理を定義します ---
export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const userId = interaction.user.id;

  

  if (subcommand === "register") {
    await interaction.deferReply({ ephemeral: true });
    const image = interaction.options.getAttachment("image");
    const name = interaction.options.getString("name");
    const isPublic = interaction.options.getBoolean("public") || false;

    // 登録数制限のチェック
    const STICKER_LIMIT = config.sticker.limitPerUser; 
    const currentStickerCount = await Sticker.count({
      where: { ownerId: userId },
    });
    if (currentStickerCount >= STICKER_LIMIT) {
      return interaction.editReply({
        content: `登録できるスタンプの上限（${STICKER_LIMIT}個）に達しています。`,
      });
    }

    // 1.ファイル形式とサイズのチェック
    const fileExt = image.name.split(".").pop().toLowerCase();
    if (!["png", "webp", "jpg", "jpeg", "gif"].includes(fileExt)) {
      return interaction.editReply({
        content:
          "対応していないファイル形式です。PNG, WebP, JPG, GIF のいずれかでアップロードしてください。",
      });
    }
    if (image.size > 512 * 1024) {
      // 512KB
      return interaction.editReply({
        content: "画像ファイルのサイズが512KBを超えています。",
      });
    }
    // 2. ファイルをダウンロードして、バッファに変換
    const fetched = await fetch(image.url);
    const buffer = Buffer.from(await fetched.arrayBuffer());

    // 3. 画素数チェック！
    try {
      const dimensions = sizeOf(buffer);
      if (dimensions.width > 320 || dimensions.height > 320) {
        return interaction.editReply({
          content: `画像のサイズが大きすぎます。幅と高さは、それぞれ320ピクセル以下にしてください。\n(現在のサイズ: ${dimensions.width}x${dimensions.height})`,
        });
      }
    } catch (e) {
      console.error("画像サイズの取得に失敗:", e);
      return interaction.editReply({
        content:
          "画像のメタデータを読み取れませんでした。ファイルが破損している可能性があります。",
      });
    }
    // 同じ名前のスタンプがすでにないかチェック
    const existingSticker = await Sticker.findOne({
      where: { ownerId: userId, name: name },
    });
    if (existingSticker) {
      return interaction.editReply({
        content: `あなたはすでに「${name}」という名前のスタンプを登録しています。`,
      });
    }

    // ディレクトリサイズ制限のチェック
        const currentStickersSize = await getDirectorySize('stickers');
    const newFileSize = image.size;
    const sizeLimit = config.sticker.directorySizeLimit;

    if (currentStickersSize === -1) {
      return interaction.editReply({ content: 'ストレージの容量を確認中にエラーが発生しました。' });
    }

    if (currentStickersSize + newFileSize > sizeLimit) {
      const currentSizeMB = (currentStickersSize / 1024 / 1024).toFixed(2);
      return interaction.editReply({ 
        content: `ストレージの上限に達するため、アップロードできません。\n(現在の使用量: ${currentSizeMB}MB / 300MB)`
      });
    }

    try {
      //const fetched = await fetch(image.url);
      //const buffer = Buffer.from(await fetched.arrayBuffer());

      // 汎用化したストレージ関数を呼び出す！
      const result = await uploadFile(buffer, userId, 0, fileExt, "stickers");

      if (!result) {
        return interaction.editReply({
          content: "画像のアップロードに失敗しました。",
        });
      }

      await Sticker.create({
        name: name,
        imageUrl: result.url,
        filePath: result.path,
        ownerId: userId,
        isPublic: isPublic,
      });

      const embed = new EmbedBuilder()
        .setTitle("✅ スタンプ登録完了")
        .setDescription(`**「${name}」**を新しいスタンプとして登録しました。`)
        .setThumbnail(result.url)
        .setColor("Green")
        .setFooter({
          text: `使用容量${((currentStickersSize + newFileSize) / 1024 / 1024).toFixed(2)}MB / 300MB`,
        })
        .addFields({
          name: "公開設定",
          value: isPublic
            ? "はい (他の人も使えます)"
            : "いいえ (あなた専用です)",
        });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("スタンプ登録エラー:", error);
      await interaction.editReply({
        content: "スタンプの登録中にエラーが発生しました。",
      });
    }
  } else if (subcommand === "post") {
    const name = interaction.options.getString("name");
    await interaction.deferReply();

    // 投稿できるスタンプか、もう一度DBで確認
    const sticker = await Sticker.findOne({
      where: {
        name: name,
        [Op.or]: [{ ownerId: userId }, { isPublic: true }],
      },
    });

    if (!sticker) {
        await interaction.editReply({ content: `スタンプ「${name}」が見つからないか、使用する権限がありません。`, ephemeral: true });
      return;
    }

    await interaction.editReply({
        files: [sticker.imageUrl],
    });
  } else if (subcommand === "delete") {
    await interaction.deferReply({ ephemeral: true });
    const name = interaction.options.getString("name");

    // 削除対象のスタンプが、本当に自分のものか確認
    const stickerToDelete = await Sticker.findOne({
      where: { name: name, ownerId: userId },
    });

    if (!stickerToDelete) {
      return interaction.editReply({
        content: `あなたが登録したスタンプ「${name}」は見つかりませんでした。`,
      });
    }

    try {
      // Supabase Storageからファイルを削除
      await deleteFile(stickerToDelete.filePath);
      // データベースからレコードを削除
      await stickerToDelete.destroy();

      await interaction.editReply({
        content: `✅ スタンプ「${name}」を削除しました。`,
      });
    } catch (error) {
      console.error("スタンプ削除エラー:", error);
      await interaction.editReply({
        content: "スタンプの削除中にエラーが発生しました。",
      });
    }
  }
}
