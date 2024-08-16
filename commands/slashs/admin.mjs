import { SlashCommandBuilder,  EmbedBuilder , PermissionsBitField} from 'discord.js';

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
      .setDescription('発言内容を記述してください')
      .setRequired(true)
    )
  );

export async function execute(interaction) {
 const subcommand = interaction.options.getSubcommand();
  if(subcommand == "chatasmaria"){
    const content = interaction.options.getString('content');
    await interaction.channel.send({
     content: content 
    });
    await interaction.reply({ 
      ephemeral: true,
      content: `メッセージを送信しました。\n送信内容\`\`\`\n${content}\n\`\`\``
  });
  }
}