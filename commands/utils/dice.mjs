import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("dice")
  .setNameLocalizations({
    ja: "ダイス",
  })
  .setDescription(
    "ダイスを振ります（結果が2000文字を超えるとエラーになります）"
  )
  .addStringOption((option) =>
    option
      .setName("ndn")
      .setDescription(
        "「1d6」「１d100+10」などの形式でダイスロールを指定してね"
      )
      .setRequired(true)
  );

export async function execute(interaction) {
  const input = interaction.options.getString("ndn");
  if (!input.match(/^(\d+)d(\d+)([+-]\d+)?$/)) {
    await interaction.reply({
      ephemeral: true,
      content: "入力が正しくありません。",
    });
    return;
  }

  await interaction.reply(ndnDice(input));
}

export function ndnDice(ndn) {
  //最初に補正値を見る
  const modifierPattern = /([+-]\d+)$/;
  const modifierMatch = ndn.match(modifierPattern);
  const modifier = modifierMatch ? parseInt(modifierMatch[0], 10) : 0;
  const ndnWithoutModifier = modifierMatch
    ? ndn.replace(modifierMatch[0], "")
    : ndn; //補正値を除去
  const ModifierDisplay = modifier > 0 ? `+${modifier}` : `${modifier}`;

  const ndnArr = ndnWithoutModifier.split("d");
  const number = ndnArr[0];
  const sides = ndnArr[1];

  const result = [];
  let sum = 0;

  //あんまりなダイスは怒るよ
  if (
    number > 100 ||
    number < 1 ||
    sides > 2147483647 ||
    modifier > 2147483647 ||
    modifier < -2147483647
  ) {
    return "そんなダイス振らないにゃ";
  }

  for (let i = 0; i < number; i++) {
    const dice = Math.floor(Math.random() * sides) + 1;
    sum += dice;
    result.push(dice);
  }
  if (number == 1 && sides == 100 && modifier == 0) {
    //1d100であればクリティカル、ファンブルの判定もする
    if (sum < 6) {
      sum = sum + "**(クリティカル！)**";
    }
    if (sum > 95) {
      sum = sum + "**(ファンブル！)**";
    }
    return `### ${number}d${sides}\n>> ${sum}`;
  }
  // 結果の表示
  if (modifier === 0) {
    return `### ${number}d${sides}\n>> ${result.join(", ")}\n合計: ${sum}`;
  } else {
    const total = sum + modifier;
    return `### ${number}d${sides}${ModifierDisplay}\n>> ${result.join(
      ", "
    )}\n合計: ${sum} ${ModifierDisplay} >> ${total}`;
  }
}
