import { ContextMenuCommandBuilder,  ApplicationCommandType, EmbedBuilder } from "discord.js";
// import { PermissionsBitField} from "discord.js";

export const data = new ContextMenuCommandBuilder()
  .setName("TEST")
  .setType(ApplicationCommandType.Message);

export async function execute(interaction) {
    if (!interaction.guild) return;
 		const { channel } = interaction;
    const message = interaction.options.getMessage("message")

    const embed = new EmbedBuilder()
      .setColor(0xEFDCAA)
      .setAuthor({ name: message.member.displayName, iconURL: message.member.displayAvatarURL()})
      .setTitle(`にゃーにゃー`)
      .setDescription(message.cleanContent)
      .setFooter({text: ""})
await interaction.reply({
            flags: [ 4096 ],//silent
            content: 'DMにメッセージをコピーしたにゃ！',
            ephemeral  : true
        });
  await interaction.member.send({
    flags: [ 4096 ],//silent
    embeds: [embed]
    });
  await interaction.reply({
    flags: [ 4096 ],//silent
    content: "DMにコピーしました。",
    ephemeral  : true
  });

 	};
 
