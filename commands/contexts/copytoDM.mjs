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
    let images = [];
    let otherfile = " ";//画像以外のファイル
    //そして添付ファイルごとに改行
    if(file){
    for (let i = 0; i < file.length; i++) {
      if(file[i].match(/(png|jpg|gif|jpeg|webp)\?ex=/)){//画像ならimages配列に
        images.push(file[i]);
        }else{
          otherfile += "\n" + file[i];
        }
      }
    }
    
    const embed = new EmbedBuilder()
      .setColor(0xEFDCAA)
      .setAuthor({ name: message.author.globalName, iconURL: message.author.displayAvatarURL()})
      .setURL(message.url)
      .setTitle("メッセージへ")
      .setDescription(message.cleanContent + otherfile)
      .setFooter({text: "「DMにメッセージをコピー」により"})
      .setImage(images[0])
      .setTimestamp(message.createdTimestamp)
//コピーを送信
    await interaction.member.send({
      flags: [ 4096 ],//silent
      embeds: [embed]
    });
//画像を追加（吐きそう…）
  if(images.length > 1){
      for (let i = 1; i < images.length; i++) {
        const embed = new EmbedBuilder()
        .setColor(0xB78CFE)
        .setImage(images[i])
        .setURL(message.url)
        
        await interaction.member.send({
        flags: [ 4096 ],//silent
        embeds: [embed]
    });
      }
  }

  //完了報告
  await interaction.reply({
            flags: [ 4096 ],//silent
            content: 'DMにメッセージをコピーしたにゃ！',
            ephemeral  : true
        });

 	};
 
