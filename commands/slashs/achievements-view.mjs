// commands/slashs/achievements-view.mjs
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { UserAchievement } from "../../models/database.mjs";
import config from "../../config.mjs";
import {
  unlockAchievements,
  unlockHiddenAchievements,
} from "../../utils/achievements.mjs";

export const help = {
  category: "slash",
  description: "自分または指定したユーザーの実績達成状況を確認します。",
};

export const data = new SlashCommandBuilder()
  .setName("achievements-view")
  .setNameLocalizations({ ja: "実績" })
  .setDescription("実績の達成状況を確認します。")
  .addUserOption((option) =>
    option
      .setName("user")
      .setNameLocalizations({ ja: "ユーザー" })
      .setDescription("他のユーザーの実績を確認します。")
      .setRequired(false)
  )
  .addIntegerOption((option) =>
    option
      .setName("page")
      .setNameLocalizations({ ja: "ページ" })
      .setDescription("表示したい実績のページを直接指定します。")
      .setRequired(false)
      .setAutocomplete(true) // これがオートコンプリートを有効にする魔法です！
      .setMinValue(1)
  )
  .addBooleanOption((option) =>
    option
      .setName("hide")
      .setNameLocalizations({ ja: "隠す" })
      .setDescription("実行結果を自分だけに表示しますか？（デフォルト: はい）")
      .setRequired(false)
  );

export async function autocomplete(interaction) {
  // ユーザーが入力中の値や、どのオプションにフォーカスしているかを取得
  const focusedOption = interaction.options.getFocused(true);

  if (focusedOption.name === "page") {
    // configから実績リストを読み込み、総ページ数を計算
    const achievements = config.idle.achievements;
    const itemsPerPage = 10;
    const totalPages = Math.ceil(achievements.length / itemsPerPage);

    const choices = [];
    for (let i = 0; i < totalPages; i++) {
      const pageNum = i + 1;
      const startId = String(i * itemsPerPage + 1).padStart(3, "0");
      const endId = String(
        Math.min((i + 1) * itemsPerPage, achievements.length)
      ).padStart(3, "0");

      // ユーザーに分かりやすい選択肢のテキストを生成
      choices.push({
        name: `ページ${pageNum}: 実績 #${startId} ～ #${endId}`,
        value: pageNum,
      });
    }

    // Discord APIの制限（25件）に合わせて、表示する選択肢を絞り込む
    const filtered = choices.filter(
      (choice) =>
        choice.name.startsWith(focusedOption.value) ||
        String(choice.value).startsWith(focusedOption.value)
    );
    await interaction.respond(filtered.slice(0, 25));
  }
}

export async function execute(interaction) {
  // --- 1. 初期設定とデータ取得 ---
  await unlockAchievements(interaction.client, interaction.user.id, 28);

  const targetUser = interaction.options.getUser("user") || interaction.user;
    // オプションで指定されたページ番号を取得。なければ1ページ目とする。
  const startPage = interaction.options.getInteger("page") || 1;
  const userId = targetUser.id;
  const isEphemeral = interaction.options.getBoolean("hide") ?? true;

  const displayName =
    interaction.guild?.members.cache.get(userId)?.displayName ||
    targetUser.username;

  // データベースから実績データを取得
  const userAchievement = await UserAchievement.findOne({ where: { userId } });
  const achievementsData = userAchievement?.achievements || {
    unlocked: [],
    progress: {},
    hidden_unlocked: [],
  };

  //251005 実績コンプリート系
  // --- 実績50「あなたは神谷マリアを遊び尽くした」のチェック ---
  const unlockedSet = new Set(achievementsData.unlocked);
  // まだ実績50を解除していない場合のみ、チェックを実行
  if (!unlockedSet.has(50)) {
    const requiredAchievements = Array.from({ length: 50 }, (_, i) => i); // 0から49までの配列
    const excludedAchievements = [23, 24, 25, 26, 27]; // どんぐり実績

    // 必須実績リストから、除外対象を除いたもの
    const finalRequired = requiredAchievements.filter(
      (id) => !excludedAchievements.includes(id)
    );

    // 必須実績のすべてが、解除済み実績の中に含まれているかチェック
    const isPlatinumUnlocked = finalRequired.every((id) => unlockedSet.has(id));

    if (isPlatinumUnlocked) {
      await unlockAchievements(interaction.client, userId, 50);
      // 新しく解除したので、ローカルのデータも更新しておく
      unlockedSet.add(50);
      achievementsData.unlocked.push(50);
    }
  }

  // --- 隠し実績10「そこに山があるから」のチェック ---
  const hiddenUnlockedSet = new Set(achievementsData.hidden_unlocked);
  // まだ隠し実績10を解除していない場合のみ、チェックを実行
  if (!hiddenUnlockedSet.has(10)) {
    const requiredHidden = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

    // 必須の隠し実績がすべて含まれているかチェック
    const isHiddenMasterUnlocked = requiredHidden.every((id) =>
      hiddenUnlockedSet.has(id)
    );

    if (isHiddenMasterUnlocked) {
      await unlockHiddenAchievements(interaction.client, userId, 10);
      // ローカルのデータも更新
      hiddenUnlockedSet.add(10);
      achievementsData.hidden_unlocked.push(10);
    }
  }

  // 表示状態を管理する変数
  let currentPage = startPage - 1; 
  let isHiddenMode = false;

  // --- 2. 表示コンポーネントを生成する関数 ---

  // Embedを生成する関数
  const generateEmbed = (page, isHidden) => {
    const sourceAchievements = isHidden
      ? config.idle.hidden_achievements
      : config.idle.achievements;
    const unlockedIds = isHidden
      ? (achievementsData.hidden_unlocked ?? [])
      : (achievementsData.unlocked ?? []);
    const progressData = achievementsData.progress ?? {};

    const itemsPerPage = 10;
    const totalPages = Math.ceil(sourceAchievements.length / itemsPerPage);
    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    const currentAchievements = sourceAchievements.slice(start, end);

    const unlockedCount = unlockedIds.length;
    let title, headerString;

    if (isHidden) {
      title = `"${displayName}" の秘密の実績 (${unlockedCount} / ${sourceAchievements.length})`;
      if (hiddenUnlockedSet.has(10)) {
        headerString =
          "それは放置ゲームにおいて、ブースト倍率を1.1倍に強化する。";
      } else {
        headerString = "薄れゆく達成感。";
      }
    } else {
      title = `"${displayName}" の実績 (${unlockedCount} / ${sourceAchievements.length})`;
      headerString = `それは放置ゲームにおいて全てのMultを${unlockedCount}%強化し、Mee6レベルを${unlockedCount}Lv高いものとして扱う。`;
    }

    const achievementListString = currentAchievements
      .map((ach) => {
        const achievementNumber = String(ach.id + 1).padStart(3, "0");
        const isUnlocked = unlockedIds.includes(ach.id);

        let statusIcon, nameAndProgress, displayValue;

        if (isUnlocked) {
          statusIcon = "✅";
          nameAndProgress = ach.name;
          displayValue = `-# ${ach.description}`;
          if (isHidden) {
            displayValue = `-# *ヒント: ${ach.hint}*\n` + displayValue;
          }
          if (!isHidden && ach.effect) {
            displayValue += `\n-# __${ach.effect}__`;
          }
        } else {
          statusIcon = "🔒";
          if (isHidden) {
            nameAndProgress = "？？？？？";
            displayValue = `-# *ヒント: ${ach.hint}*`;
          } else {
            nameAndProgress = ach.name;
            const currentProgress = progressData[ach.id];
            if (currentProgress !== undefined && ach.goal) {
              statusIcon = "🔄";
              nameAndProgress += ` (${currentProgress.toLocaleString()} / ${ach.goal.toLocaleString()})`;
            }
            displayValue = `-# ${ach.description}${ach.effect ? `\n-# __${ach.effect}__` : ""}`;
          }
        }
        return `**#${achievementNumber} ${statusIcon} ${nameAndProgress}**\n${displayValue}`;
      })
      .join("\n");

    const fullDescription = `${headerString}\n\n${achievementListString}`;

    return new EmbedBuilder()
      .setColor(isHidden ? "DarkPurple" : "Gold")
      .setTitle(title)
      .setDescription(fullDescription)
      .setFooter({ text: `ページ ${page + 1} / ${totalPages}` });
  };

  // ボタンを生成する関数
  const generateButtons = (page, isHidden) => {
    const sourceAchievements = isHidden
      ? config.idle.hidden_achievements
      : config.idle.achievements;
    const totalPages = Math.ceil(sourceAchievements.length / 10);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("prev_page")
        .setLabel("◀")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId("next_page")
        .setLabel("▶")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page >= totalPages - 1)
    );

    if (isEphemeral) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId("toggle_view")
          .setEmoji(isHidden ? "📖" : "🗑️")
          .setStyle(ButtonStyle.Secondary)
      );
    }
    return row;
  };

  // --- 3. メッセージの送信とインタラクションの待受 ---

  const message = await interaction.reply({
    embeds: [generateEmbed(currentPage, isHiddenMode)],
    components: [generateButtons(currentPage, isHiddenMode)],
    ephemeral: isEphemeral,
    fetchReply: true,
  });

  // 公開メッセージの場合は、コレクターをセットアップせずに処理を終了
  //if (!isEphemeral) return;

  const collector = message.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id,
    time: 120_000,
  });

  collector.on("collect", async (i) => {
    try {
      if (i.customId === "prev_page") {
        if (currentPage > 0) currentPage--;
      } else if (i.customId === "next_page") {
        const source = isHiddenMode
          ? config.idle.hidden_achievements
          : config.idle.achievements;
        const totalPages = Math.ceil(source.length / 10);
        if (currentPage < totalPages - 1) currentPage++;
      } else if (i.customId === "toggle_view") {
        isHiddenMode = !isHiddenMode;
        currentPage = 0;

        if (isHiddenMode) {
          await unlockHiddenAchievements(
            interaction.client,
            interaction.user.id,
            0
          );
        }
      }

      await i.update({
        embeds: [generateEmbed(currentPage, isHiddenMode)],
        components: [generateButtons(currentPage, isHiddenMode)],
      });
    } catch (error) {
      console.error("実績表示の更新中にエラーが発生しました:", error);
    }
  });

  collector.on("end", async () => {
    try {
      const finalComponents = generateButtons(
        currentPage,
        isHiddenMode
      ).components.map((c) => c.setDisabled(true));
      await interaction.editReply({
        components: [new ActionRowBuilder().addComponents(finalComponents)],
      });
    } catch (error) {
      // ユーザーがメッセージを削除した場合など、編集に失敗することがあるためエラーを握りつぶす
      console.log(
        "実績表示のボタン無効化に失敗しました (メッセージが削除された可能性があります)"
      );
    }
  });
}
