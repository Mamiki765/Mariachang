import { ContextMenuCommandBuilder,  ApplicationCommandType, EmbedBuilder } from "discord.js";
// import { PermissionsBitField} from "discord.js";

export const data = new ContextMenuCommandBuilder()
  .setName("TEST")
  .setType(ApplicationCommandType.Message);

export async function execute(interaction) {
    if (!interaction.guild) return;
 		const { channel } = interaction;
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
 
