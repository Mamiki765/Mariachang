import { SlashCommandBuilder,  EmbedBuilder , PermissionsBitField} from 'discord.js';
import {createEmbed} from "../utils/messageutil.mjs"

import config from "../../config.mjs"

export const data = new SlashCommandBuilder()
  .setName("admin")
  .setDescription("管理用")
// 管理者権限のみで実行可能
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator.toString())
//マリアで発言機能登録
  .addSubcommand((subcommand) =>
    subcommand
      .setName("chat_as_maria").setDescription("管理人として発言します。画像などは別の場所に貼り付けてリンクをコピーしてください。")
      .addStringOption(option =>
        option
          .setName('message')
          .setDescription('発言内容を記述(改行は\n、<br>、@@@などでもできます)')
          .setRequired(true)
    )        
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('送信先チャンネルを指定してください(指定が無ければ現在のチャンネルに送信します)')
          .addChannelTypes(
            0,  // テキストチャンネル
            5,  // ニュースチャンネル
            10, // ニューススレッド
            11, //公開スレッド
            12, //プライベートスレッド
          )
      )
  )
 .addSubcommand((subcommand) =>
    subcommand
      .setName("dm_from_maria").setDescription("管理人としてマリアからDMを送信します。（未実装）")
      .addStringOption(option =>
        option
          .setName('message')
          .setDescription('発言内容を記述(改行は\n、<br>、@@@などでもできます)')
          .setRequired(true)
    )
      .addUserOption(option =>
        option
          .setName('user')
          .setDescription('DMを送信する相手を指定してください。')
          .setRequired(true)
    )
    
                   );
//マリアで発言機能登録ここまで

export async function execute(interaction) {
 const subcommand = interaction.options.getSubcommand();
  //chat as maria
  if(subcommand == "chat_as_maria"){
    let content = interaction.options.getString('message');
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    // 改行文字を置き換え
    content = content
      .replace(/@@@/g, '\n')
      .replace(/<br>/g, '\n')
      .replace(/\\n/g, '\n');
    try{    
      // メッセージを指定されたチャンネルに送信
      await targetChannel.send({
        content: content
      });
    await interaction.client.channels.cache.get(config.logch.admin).send({
      flags: [ 4096 ],
      embeds: [
                      new EmbedBuilder()
                      .setTitle("管理者発言ログ(チャンネル)")
                      .setColor("#FFD700")
                      .setDescription(`送信内容\`\`\`\n${content}\n\`\`\``)
                      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                      .setTimestamp()
                      .addFields(
                      {
                        name: "送信者",
                        value: `${interaction.member.displayName}(ID:${interaction.user.id})`
                      }
                      ,{
                        name: "送信チャンネル",
                        value: `#${targetChannel.name} (<#${targetChannel.id}>)`
                      })
                  ]
    });
    await interaction.reply({ 
      ephemeral: true,
      content: `メッセージを送信しました。\n送信内容\`\`\`\n${content}\n\`\`\``
  });
      }catch(e){
    console.error('メッセージ送信に失敗しました:', e);
    await interaction.reply({
      ephemeral: true,
      content: `メッセージの送信に失敗しました: ${e.message}`
    });
    }
  } else if(subcommand == "dm_from_maria") {
        let content = interaction.options.getString('message');
    const targetUser = interaction.options.getUser('user');
    // 改行文字を置き換え
    content = content
      .replace(/@@@/g, '\n')
      .replace(/<br>/g, '\n')
      .replace(/\\n/g, '\n');
        try{
      const embed = createEmbed(null, '管理人からのメッセージ', sendmessage, fetchedMessage.author, images[0], fetchedMessage.createdAt, '#FFD700', "このbotへの返信
                                
                  は");    
      // メッセージを指定されたチャンネルに送信
      await targetUser.send({
        content: `# 管理人室からメッセージがありました。以下内容：\n` + content,
        
      });
    await interaction.client.channels.cache.get(config.logch.admin).send({
      flags: [ 4096 ],
      embeds: [
                      new EmbedBuilder()
                      .setTitle("管理者発言ログ(DM)")
                      .setColor("#FFD700")
                      .setDescription(`送信内容\`\`\`\n${content}\n\`\`\``)
                      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                      .setTimestamp()
                      .addFields(
                      {
                        name: "送信者",
                        value: `${interaction.member.displayName}(ID:${interaction.user.id})`
                      }
                      ,{
                        name: "送信相手",
                        value: `#${targetUser.username} (<@${targetUser.id}>)`
                      })
                  ]
    });
    await interaction.reply({ 
      ephemeral: true,
      content: `${targetUser.Displayname}にメッセージを送信しました。\n送信内容\`\`\`\n${content}\n\`\`\``
  });
      }catch(e){
    console.error('メッセージ送信に失敗しました:', e);
    await interaction.reply({
      ephemeral: true,
      content: `メッセージの送信に失敗しました: ${e.message}`
    });
    }
  }
}