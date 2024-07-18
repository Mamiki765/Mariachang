import { ContextMenuCommandBuilder,  ApplicationCommandType, EmbedBuilder } from "discord.js";
// import { PermissionsBitField} from "discord.js";

export const data = new ContextMenuCommandBuilder()
  .setName("DMにメッセージをコピー")
  .setType(ApplicationCommandType.Message);

export async function execute(interaction) {
    if (!interaction.guild) return;
 		const { channel } = interaction;
    const message = interaction.options.getMessage("message")

  　　const flie = message.attachments.map(attachment => attachment.url)//添付ファイルのURLを配列で取得
//    console.log(flie);//debug
  
    const embed = new EmbedBuilder()
      .setColor(0xEFDCAA)
      .setAuthor({ name: message.author.globalName, iconURL: message.author.displayAvatarURL()})
      .setTitle(message.url)
      .setDescription(message.cleanContent + "\n" + flie)
      .setFooter({text: "「DMにメッセージをコピー」により"})
      .setTimestamp(message.createdTimestamp)
await interaction.reply({
            flags: [ 4096 ],//silent
            content: 'DMにメッセージをコピーしたにゃ！',
            ephemeral  : true
        });
  await interaction.member.send({
    flags: [ 4096 ],//silent
    embeds: [embed]
    });

 	};
 
