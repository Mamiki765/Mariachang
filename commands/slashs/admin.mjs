import { SlashCommandBuilder,  EmbedBuilder , PermissionsBitField} from 'discord.js';

import config from "../../config.mjs"

export const data = new SlashCommandBuilder()
  .setName("admin")
  .setDescription("管理用")
// 管理者権限のみで実行可能
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator.toString())
  .addSubcommand((subcommand) =>
    subcommand
      .setName("chatasmaria").setDescription("匿名としてマリアが発言します（作成中）")
      .addStringOption(option =>
    option
      .setName('content')
      .setDescription('発言内容を記述(改行は\n、<br>、@@@のどれかでできます)')
      .setRequired(true)
    )
  );

export async function execute(interaction) {
 const subcommand = interaction.options.getSubcommand();
  if(subcommand == "chatasmaria"){
    let content = interaction.options.getString('content');
    // 改行文字を置き換え
    content = content
      .replace(/@@@/g, '\n')
      .replace(/<br>/g, '\n')
      .replace(/\\n/g, '\n');
    
    await interaction.channel.send({
     content: content 
    });
    await interaction.client.channels.cache.get(config.logch.admin).send({
      content: `管理者メッセージが送信されました。`,
      flags: [ 4096 ],
      embeds: [
                      new EmbedBuilder()
                      .setTitle("管理者発言ログ")
                      .setColor("#FFD700")
                      .setDescription(`送信内容\`\`\`\n${content}\n\`\`\``)
                      .addFields(
                      {
                        name: "送信チャンネル",
                        value: `${interaction.channel}`
                      })
                  ]
    });
    await interaction.reply({ 
      ephemeral: true,
      content: `メッセージを送信しました。\n送信内容\`\`\`\n${content}\n\`\`\``
  });
  }
}