import { ContextMenuCommandBuilder,  ApplicationCommandType, EmbedBuilder , PermissionsBitField} from "discord.js";

export const data = new ContextMenuCommandBuilder()
  .setName("テスト")
  .setType(ApplicationCommandType.Message);

export async function execute(interaction) {
 		const { channel } = interaction;
 		if (!channel.permissionsFor(PermissionsBitField.Flags.ViewChannel))
 			return interaction.reply({
 				content: "BOTにチャンネル閲覧の権限がありません。",
 				ephemeral: true
 			});
 		if (!channel.permissionsFor(PermissionsBitField.Flags.ManageMessages))
    			return interaction.reply({
    				content: "BOTにメッセージ管理の権限がありません。",
    				ephemeral: true
    			});
    		const message = interaction.options.getMessage("message")
    		if (message.system) return interaction.reply({
    			content: "システムメッセージはピン留めができません。",
    			ephemeral: true
    		});
    		if (message.pinned){
    			await message.unpin();
    			interaction.reply("メッセージのピン留めを解除しました。");
    		} else {
    			await message.pin();
    			interaction.reply("メッセージのピン留めをしました。");
    		};
 	};
 
