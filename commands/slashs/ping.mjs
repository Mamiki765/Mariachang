import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import os from "os";
import { deletebuttonanyone } from "../../components/buttons.mjs";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("このbotが生きてるかチェックします");

export async function execute(interaction) {
  //ping確認
  const apiPing = Date.now() - interaction.createdTimestamp;

  await interaction.reply({
    flags: [4096],
    //    content: `<@${interaction.user.id}>`,
    embeds: [
      new EmbedBuilder()
        .setTitle(":ping_pong:Pongにゃ!")
        .setDescription("Ping値を表示します。")
        .addFields(
          {
            name: ":electric_plug:WebSocket Ping",
            value: "`" + interaction.client.ws.ping + "ms`",
          },
          {
            name: ":yarn:API Endpoint Ping",
            value: "`" + apiPing + "ms`",
          }
        )
        .setColor("#2f3136")
        .setTimestamp(),
    ],
    components: [deletebuttonanyone],
  });
}
