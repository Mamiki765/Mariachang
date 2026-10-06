import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { unlockAchievements } from "../../utils/achievements.mjs";

const HAKONIWA_URL = "https://hakoniwa.pbwlove.com";

export const help = {
  category: "slash",
  description: "箱庭諸島2S+へのリンクを表示します。",
};

export const data = new SlashCommandBuilder()
  .setName("hakoniwa")
  .setNameLocalizations({ ja: "箱庭" })
  .setDescription("箱庭諸島2S+へのリンクを表示します。");

export async function execute(interaction) {
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle("箱庭諸島2S+")
        .setDescription("下のボタンから箱庭諸島2S+を開けます。")
        .setColor("#4caf50"),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("箱庭諸島2S+を開く")
          .setStyle(ButtonStyle.Link)
          .setURL(HAKONIWA_URL)
      ),
    ],
  });

  await unlockAchievements(interaction.client, interaction.user.id, 150);
}
