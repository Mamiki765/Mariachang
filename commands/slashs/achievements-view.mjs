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
    interaction.guild?.members.cache.get(userId)?.displayName || targetUser.username;

  // DBからユーザーの解除済み実績IDを取得（なければ []）
  const userAchievement = await UserAchievement.findOne({ where: { userId } });
  const unlockedIds = userAchievement?.achievements?.unlocked || [];
  const progressData = userAchievement?.achievements?.progress || {}; // progressデータを取得
  const allAchievements = config.idle.achievements;

  // ページング設定
  const itemsPerPage = 10;
  const totalPages = Math.ceil(allAchievements.length / itemsPerPage);
  let currentPage = 0;

  // Embed生成関数
  const generateEmbed = (page) => {
    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    const currentAchievements = allAchievements.slice(start, end);

    return new EmbedBuilder()
      .setColor("Gold")
      .setTitle(`"${displayName}" の実績 (${unlockedIds.length} / ${allAchievements.length})`)
      .setDescription(`それは放置ゲームにおいて全てのMultを${unlockedIds.length}%強化し、Mee6レベルを${unlockedIds.length}Lv高いものとして扱う。`)
      .addFields(
        // ★★★ 表示ロジックを修正 ★★★
        currentAchievements.map((ach) => {
          const isUnlocked = unlockedIds.includes(ach.id);
          const currentProgress = progressData[ach.id]; // 該当実績の進捗を取得

          let displayName = ach.name;
          let displayValue = `${ach.description}${ach.effect ? `\n__${ach.effect}__` : ''}`;

          if (isUnlocked) {
            displayName = `✅ ${ach.name}`;
            displayValue = `**${displayValue}**`;
          } else if (currentProgress !== undefined && ach.goal) {
            // 進捗中かつ目標値(goal)が設定されている実績
            displayName = `🔄 ${ach.name} (${currentProgress.toLocaleString()} / ${ach.goal.toLocaleString()})`;
            displayValue = `*(${displayValue})*`; // 未解除なのでイタリック体
          } else {
            // 未着手
            displayName = `🔒 ${ach.name}`;
            displayValue = `*(${displayValue})*`; // 未解除なのでイタリック体
          }

          return {
            name: displayName,
            value: displayValue,
          };
        })
      )
      .setFooter({ text: `ページ ${page + 1} / ${totalPages}` });
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
    const disabledButtons = generateButtons(currentPage).components.map(c => c.setDisabled(true));
    await interaction.editReply({
      components: [new ActionRowBuilder().addComponents(disabledButtons)],
    });
  });
}