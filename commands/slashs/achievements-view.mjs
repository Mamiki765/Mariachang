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
import { unlockAchievements } from "../../utils/achievements.mjs";

// --- 骨格①：コマンドの説明 ---
export const help = {
  category: "slash",
  description: "自分または指定したユーザーの実績達成状況を確認します。",
};

// --- 骨格②：コマンドの定義 ---
export const data = new SlashCommandBuilder()
  .setName("achievements-view") // ファイル名と合わせるのがおすすめです
  .setNameLocalizations({ ja: "実績" })
  .setDescription("実績の達成状況を確認します。")
  .addUserOption((option) =>
    option
      .setName("user")
      .setNameLocalizations({ ja: "ユーザー" })
      .setDescription("他のユーザーの実績を確認します。")
      .setRequired(false)
  );

// --- 骨格③：コマンド実行時の入り口 ---
export async function execute(interaction) {
  await unlockAchievements(interaction.client, interaction.user.id, 28);
  const targetUser = interaction.options.getUser("user") || interaction.user;
  const userId = targetUser.id;

  // ギルド内ならニックネーム優先、なければ username
  const displayName =
    interaction.guild?.members.cache.get(userId)?.displayName ||
    targetUser.username;

  // DBからユーザーの解除済み実績IDを取得（なければ []）
  const userAchievement = await UserAchievement.findOne({ where: { userId } });
  const unlockedIds = userAchievement?.achievements?.unlocked || [];
  const progressData = userAchievement?.achievements?.progress || {}; // progressデータを取得
  const allAchievements = config.idle.achievements;

  const itemsPerPage = 10;
  const totalPages = Math.ceil(allAchievements.length / itemsPerPage);
  let currentPage = 0;

  // ページング設定
  const generateEmbed = (page) => {
    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    const currentAchievements = allAchievements.slice(start, end);

    // --- 1. ヘッダーとなる説明文を動的に生成 ---
    const unlockedCount = unlockedIds.length;
    const headerString = `それは放置ゲームにおいて全てのMultを${unlockedCount}%強化し、Mee6レベルを${unlockedCount}Lv高いものとして扱う。`;

    // --- 2. 表示する実績リストを文字列として組み立てる ---
    const achievementListString = currentAchievements
      .map((ach) => {
        // 実績番号を ID + 1 で生成
        const achievementNumber = String(ach.id + 1).padStart(3, "0");

        const isUnlocked = unlockedIds.includes(ach.id);
        const currentProgress = progressData[ach.id];
        const displayValue = `-# ${ach.description}${ach.effect ? `\n-# __${ach.effect}__` : ''}`;
        let statusIcon;
        let nameAndProgress = ach.name;

        if (isUnlocked) {
          statusIcon = "✅";
        } else if (currentProgress !== undefined && ach.goal) {
          statusIcon = "🔄";
          nameAndProgress += ` (${currentProgress.toLocaleString()} / ${ach.goal.toLocaleString()})`;
        } else {
          statusIcon = "🔒";
        }

        return `**#${achievementNumber} ${statusIcon} ${nameAndProgress}**\n${displayValue}`;
      })
      .join("\n");

    // --- 3. ヘッダーと実績リストを結合 ---
    const fullDescription = `${headerString}\n\n${achievementListString}`;

    // --- 4. Embedを生成 ---
    return (
      new EmbedBuilder()
        .setColor("Gold")
        .setTitle(
          `"${displayName}" の実績 (${unlockedCount} / ${allAchievements.length})`
        )
        // 結合した最終的な説明文をセット
        .setDescription(fullDescription)
        .setFooter({ text: `ページ ${page + 1} / ${totalPages}` })
    );
  };

  // ボタン生成関数
  const generateButtons = (page) =>
    new ActionRowBuilder().addComponents(
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

  // 最初のメッセージ送信
  const message = await interaction.reply({
    embeds: [generateEmbed(currentPage)],
    components: [generateButtons(currentPage)],
    fetchReply: true,
  });

  // ボタン操作用コレクター
  const collector = message.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id || i.user.id === userId,
    time: 120_000,
  });

  collector.on("collect", async (i) => {
    if (i.customId === "prev_page" && currentPage > 0) {
      currentPage--;
    } else if (i.customId === "next_page" && currentPage < totalPages - 1) {
      currentPage++;
    }
    await i.update({
      embeds: [generateEmbed(currentPage)],
      components: [generateButtons(currentPage)],
    });
  });

  collector.on("end", async () => {
    const disabledButtons = generateButtons(currentPage).components.map((c) =>
      c.setDisabled(true)
    );
    await interaction.editReply({
      components: [new ActionRowBuilder().addComponents(disabledButtons)],
    });
  });
}
