import {
	ContextMenuCommandBuilder,
	ApplicationCommandType,
	EmbedBuilder
} from "discord.js";
// import { PermissionsBitField} from "discord.js";

export const data = new ContextMenuCommandBuilder()
	.setName("ピン留めの登録/解除")
	.setType(ApplicationCommandType.Message);

export async function execute(interaction) {
	if (!interaction.guild) return;
	const {
		channel
	} = interaction;
	const message = interaction.options.getMessage("message")
	if (message.system) return interaction.reply({
		content: "システムメッセージはピン留めができません。",
		ephemeral: true
	});
	if (message.pinned) {
		await message.unpin();
		interaction.reply({
			flags: [4096],
			content: '**[メッセージ]( ' + message.url + ' )**のピン留めを解除しました。'
		});
	} else {
		try {
			await message.pin();
			interaction.reply({
				flags: [4096],
				content: '**[メッセージ]( ' + message.url + ' )**のピン留めをしました。'
			});
		} catch (error) {
			interaction.reply({
				content: `ピン留めができませんでした。上限に到達してる可能性があります。`,
				ephemeral: true
			});
		}
	};
};