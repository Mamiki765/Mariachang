import { SlashCommandBuilder, ActionRowBuilder } from "discord.js";
// 既存のログインボーナスボタンを、再利用します！
import { acornLoginButtonComponent } from "../../components/buttons.mjs";

export const scope = "guild"; // 指定ギルドでのみ使用可

export const help = {
  category: "slash",
  description: "ログインボーナス受け取り用のボタンを呼び出します。",
  notes: "朝8時/夜22時の時報のボタンと一緒です。見逃してしまった時にどうぞ。",
};

export const data = new SlashCommandBuilder()
  .setName("loginbonus")
  .setNameLocalizations({ ja: "ログボを受け取る" })
  .setDescription("ログインボーナス用のボタンを、あなただけに表示します。");

export async function execute(interaction) {
  // ボタン本体を、新しい「行」に入れる
  const row = new ActionRowBuilder().addComponents(acornLoginButtonComponent);

  // ephemeral (自分だけに表示) で、ボタンを返信するだけ！
  await interaction.reply({
    content: "どんぐり拾う場所が見つからないのにゃ？しょうがないにゃあ…",
    components: [row],
    ephemeral: true,
  });
}