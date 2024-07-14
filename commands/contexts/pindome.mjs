import { ContextMenuCommandBuilder,  ApplicationCommandType, EmbedBuilder , PermissionsBitField} from "discord.js";

export const data = new ContextMenuCommandBuilder()
  .setName("ピン留めの登録/解除")
  .setType(ApplicationCommandType.Message);

export async function execute(interaction) {
    if (!interaction.guild) return;
 		const { channel } = interaction;
 	/*管理権限あげてるので見つかるわけがない
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
          */
    		const message = interaction.options.getMessage("message")
    		if (message.system) return interaction.reply({
    			content: "システムメッセージはピン留めができません。",
    			ephemeral: true
    		});
    		if (message.pinned){
    			await message.unpin();
    			interaction.reply("メッセージのピン留めを解除しました。\n対象：" + message.url);
    		} else {
    			await message.pin();
    			interaction.reply("メッセージのピン留めをしました。\n対象：" + message.url);
    		};
 	};
 
