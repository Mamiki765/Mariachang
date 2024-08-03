import {
  SlashCommandBuilder
} from "discord.js";


export const data = new SlashCommandBuilder()
  .setName('suyasuya')
  .setDescription('【！注意！】発言ができなくなります！（自粛用にどうぞ）')
  .addStringOption(option =>
    option
      .setName('minutes')
      .setDescription('タイムアウトする時間を分単位で入力してください（１-720）')
      .setRequired(true)
  );

export async function execute(interaction){
  const nerunonya = interaction.options.getString('minutes');
  if (nerunonya < 1) {
        return await interaction.reply({
            flags: [ 4096 ],//silent
            content: '常識的な数字を入力してくださいにゃ。',
            ephemeral: true
        });
    }
  if (nerunonya > 720) {
        return await interaction.reply({
            flags: [ 4096 ],//silent
            content: '永遠に寝るつもりにゃ？',
            ephemeral: true
        });
    }
  if(interaction.memberPermissions.has('ADMINISTRATOR'){
        return await interaction.reply({
            flags: [ 4096 ],//silent
            content: '永遠に寝るつもりにゃ？',
            ephemeral: true
        });
    }
     
  await interaction.member.timeout(60 * 1000 * nerunonya, "/suyasuyaによるセルフタイムアウト");
	await interaction.reply({
    flags: [ 4096 ],//silent
    content: interaction.member.displayName + "を" + nerunonya + '分間封殺するにゃ、精々作業なり睡眠なりするにゃ！（セルフタイムアウトされました）'
  });

}
