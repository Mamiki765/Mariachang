import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  EmbedBuilder
} from "discord.js";
// import { PermissionsBitField} from "discord.js";

import {
  deletebuttonanyone
} from "../../components/buttons.mjs"

export const data = new ContextMenuCommandBuilder()
  .setName("DMにメッセージをコピー")
  .setType(ApplicationCommandType.Message);

export async function execute(interaction) {
  if (!interaction.guild) return;
  const {
    channel
  } = interaction;
  const message = interaction.options.getMessage("message")

  const file = message.attachments.map(attachment => attachment.url) //添付ファイルのURLを配列で取得
  //    console.log(flie);//debug
  let images = [];
  let otherfile = " "; //画像以外のファイル
  //そして添付ファイルごとに改行
  if (file) {
    for (let i = 0; i < file.length; i++) {
      if (file[i].match(/(png|jpg|gif|jpeg|webp)\?ex=/)) { //画像ならimages配列に
        images.push(file[i]);
      } else {
        otherfile += "\n" + file[i];
      }
    }
  }
  //メッセージ内の画像URLも取得し添付ファイルに
  const imageUrlRegex = /https:\/\/[^\s]+?\.(png|jpg|jpeg|gif|webp)(?:\?[^\s]*)?/gi;
  const imgmatches = message.content.matchAll(imageUrlRegex);
  const imageUrls = [...imgmatches].map(match => match[0]);
  images = [...images, ...imageUrls];
  //コピーを作成
  const embeds = [];
  const embed = new EmbedBuilder()
    .setColor(0xEFDCAA)
    .setAuthor({
      name: `${message.author.globalName} ${channel.guild.name} ${channel.name}`,
      iconURL: message.author.displayAvatarURL()
    })
    .setURL(message.url)
    .setTitle("メッセージへ")
    .setDescription(message.cleanContent + otherfile)
    .setFooter({
      text: "「DMにメッセージをコピー」により"
    })
    .setImage(images[0])
    .setTimestamp(message.createdTimestamp)

  embeds.push(embed);


  //添付ファイルの画像を追加
  if (images.length > 1) {
    for (let i = 1; i < images.length; i++) {
      const embed = new EmbedBuilder()
        .setColor(0xB78CFE)
        .setImage(images[i])

      embeds.push(embed);
    }
  }

  //コピーを送信
  await interaction.member.send({
    flags: [4096], //silent
    embeds: embeds,
    components: [deletebuttonanyone]
  });

  //完了報告
  await interaction.reply({
    flags: [4096], //silent
    content: 'DMにメッセージをコピーしたにゃ！',
    ephemeral: true
  });

};