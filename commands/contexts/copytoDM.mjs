import { ContextMenuCommandBuilder,  ApplicationCommandType, EmbedBuilder } from "discord.js";
// import { PermissionsBitField} from "discord.js";

export const data = new ContextMenuCommandBuilder()
  .setName("DMにメッセージをコピー")
  .setType(ApplicationCommandType.Message);

export async function execute(interaction) {
    if (!interaction.guild) return;
 		const { channel } = interaction;
    const message = interaction.options.getMessage("message")

  　　const file = message.attachments.map(attachment => attachment.url)//添付ファイルのURLを配列で取得
    //    console.log(flie);//debug
    let otherfile = "";//画像以外のファイル
    //
    if(file){
    for (let i = 0; i < file.length; i++) {
    otherfile += "\n" + file[i];
  }
    }
    
    const embed = new EmbedBuilder()
      .setColor(0xEFDCAA)
      .setAuthor({ name: message.author.globalName, iconURL: message.author.displayAvatarURL()})
      .setTitle(message.url)
      .setDescription(message.cleanContent + otherfile)
      .setFooter({text: "「DMにメッセージをコピー」により"})
      .setTimestamp(message.createdTimestamp)
//コピーを送信
    await interaction.member.send({
      flags: [ 4096 ],//silent
      embeds: [embed]
    });

  //完了報告
  await interaction.reply({
            flags: [ 4096 ],//silent
            content: 'DMにメッセージをコピーしたにゃ！',
            ephemeral  : true
        });

 	};
 
