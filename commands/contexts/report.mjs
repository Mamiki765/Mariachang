import { ContextMenuCommandBuilder,  ApplicationCommandType, EmbedBuilder , PermissionsBitField, ModalBuilder , TextInputBuilder, TextInputStyle, ActionRowBuilder} from "discord.js";

export const data = new ContextMenuCommandBuilder()
  .setName("test")
  .setType(ApplicationCommandType.Message);

export async function execute(interaction) {
   		const modal = new ModalBuilder()
 				.setTitle("タイトル")
 				.setCustomId("user_submit");
 			const TextInput = new TextInputBuilder()
 				.setLabel("入力欄")
 				.setCustomId("report")
 				.setStyle(TextInputStyle.Paragraph)
        .setMaxLength(2000)
        .setMinLength(2)
        .setRequired(true);
  			const ActionRow = new ActionRowBuilder().setComponents(TextInput);
   			modal.setComponents(ActionRow);
   			return interaction.showModal(modal);
}