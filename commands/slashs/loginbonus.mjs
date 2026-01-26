import { SlashCommandBuilder, ActionRowBuilder } from "discord.js";
import { 
  toggleLogiboNotificationButton // 追加したボタンをインポート
} from "../../components/buttons.mjs";
import { Point } from "../../models/database.mjs"; // DB参照用

export const help = {
  category: "slash",
  description: "ログボ自動受取時のDM通知設定を行います。", // 説明更新
  notes: "DM通知が煩わしい場合はここでOFFにできます。",
};

export const data = new SlashCommandBuilder()
  .setName("loginbonus")
  .setNameLocalizations({ ja: "ログボ通知変更" })
  .setDescription("ログボ受取通知設定の確認・変更を行います。");

export async function execute(interaction) {
  // まずユーザーの現在の設定を確認する
  // (findOrCreateにしておくと、初データ作成時も安心です)
  const [pointEntry] = await Point.findOrCreate({
    where: { userId: interaction.user.id },
  });

  // 現在の状態
  const isNotifyOn = pointEntry.loginBonusNotification;
  const statusText = isNotifyOn ? "✅ ON (通知する)" : "🔕 OFF (通知しない)";

  // ボタンを並べる
  const row = new ActionRowBuilder()
    .addComponents(
      toggleLogiboNotificationButton   // 新しい設定切替ボタン
    );

  // メッセージ作成
  await interaction.reply({
    content: `### ログインボーナス設定\n` +
             `現在の自動受取時のDM通知設定: **${statusText}**\n` +
             `-# OFFでもログインボーナス自体は受け取ります。\n` +
             `-# 規定回数でもらえる実績通知は止まりません。`,
    components: [row],
    ephemeral: true,
  });
}