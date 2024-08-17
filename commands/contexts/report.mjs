import { ContextMenuCommandBuilder,  ApplicationCommandType, EmbedBuilder } from "discord.js";

export const data = new ContextMenuCommandBuilder()
  .setName("⚠️このメッセージを報告(準備中)")
  .setType(ApplicationCommandType.Message);

export async function execute(interaction) {
  if (!interaction.guild) return; 
    if (!interaction.guild) return;
 		const { channel } = interaction;
    		const message = interaction.options.getMessage("message")
    		if (message.system) return interaction.reply({
    			content: "システムメッセージは通報ができません。",
    			ephemeral: true
    		});
  
}