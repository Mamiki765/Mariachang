import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('dice')
  .setDescription('ダイスを振ります（結果が2000文字を超えるとエラーになります）')
  .addStringOption(option =>
    option
      .setName('ndn')
      .setDescription('「1d6」形式でダイスロールを指定してね')
      .setRequired(true)
  );

export async function execute(interaction){
  const input = interaction.options.getString('ndn');
  if (!input.match(/^\d+d\d+$/)) {
    await interaction.reply({
      flags: [ 4096 ],
      content:'入力が正しくありません。'
    });
    return;  
  }

	await interaction.reply(ndnDice(input));
}

export function ndnDice(ndn){
  const ndnArr = ndn.split('d');
  const number = ndnArr[0];
  const sides = ndnArr[1];
  
  const result = [];
  let sum = 0;
  
//あんまりなダイスは怒るよ
  if (number > 100　|| number < 1 || sides > 2147483647) {
        return 'そんなダイス振らないにゃ';
  }

  for (let i = 0; i < number; i++) {
    const dice = Math.floor(Math.random() * sides) + 1;
    sum += dice;
    result.push(dice);
  }

	return `### ${number}d${sides}\n>> ${result}\n合計:${sum}`;
}