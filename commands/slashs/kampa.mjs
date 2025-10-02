import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { unlockHiddenAchievements } from "../../utils/achievements.mjs";

export const help = {
  category: "slash",
  description: "制作者にbot代のカンパが出来ます。",
  notes:
    "雨宿りの機能維持には毎年30ドルほど必要です。\n-# したいっていわれたからおいてるけどしなくていいからね…？お金は自分のしたいことに使おうね…？",
};

export const data = new SlashCommandBuilder()
  .setName("kampa")
  .setNameLocalizations({
    ja: "カンパする",
  })
  .setDescription("15円からできるカンパです。");

export const scope = "guild"; // 指定ギルドでのみ使用可

export async function execute(interaction) {
  await interaction.reply({
    flags: [4096, 64], //silent,ephemeral
    embeds: [
      new EmbedBuilder()
        .setTitle("お願い")
        .setDescription(
          "もしマリアの事を気に入ってくれたらにゃけど…\n（botの制作者にカンパします、しても何も良いことはありません)"
        )
        .setColor("#2f3136")
        .setTimestamp()
        .setFooter({
          text: "…けど、ちょっと生きてて良かったかなって、思います。",
        }),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("しょうがないにゃあ")
          .setStyle(ButtonStyle.Link)
          .setURL(process.env.kampa)
      ),
    ],
  });
  //実績i1
   await unlockHiddenAchievements(interaction.client, interaction.user.id, 1);
}
