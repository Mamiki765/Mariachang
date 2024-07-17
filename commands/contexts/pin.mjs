import { ContextMenuCommandBuilder,  ApplicationCommandType, EmbedBuilder , PermissionsBitField} from "discord.js";

export const data = new ContextMenuCommandBuilder()
  .setName("ピン留めの登録/解除")
  .setType(ApplicationCommandType.Message);

export async function execute(interaction) {
    if (!interaction.guild) return;
 		const { channel } = interaction;
  /*このBOTを導入している時点で管理権限があるのでここは必要ない
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
    			interaction.reply({
            flags: [ 4096 ],
            content: '**[メッセージ]( ' + message.url + ' )**のピン留めを解除しました。'});
    		} else {
    			await message.pin();
    			interaction.reply({
            flags: [ 4096 ],
            content: '**[メッセージ]( ' + message.url + ' )**のピン留めをしました。'});
    		};
 	};
 
