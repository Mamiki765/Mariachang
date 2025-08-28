import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const help = {
  category: "slash",
  description: "ダイスを振れます。補正値(+10など)もかけれます",
  notes: "最大100個、面数は2,147,483,647までです。",
};

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
      .setDescription("「1d6」「1d100+10」などの形式でダイスロールを指定してね")
      .setRequired(true)
  );

export async function execute(interaction) {
  const input = interaction.options.getString("ndn");
  if (!input.match(/^(\d+)d(\d+)([+-]\d+)?$/)) {
    await interaction.reply({
      flags: 64, //ephemeral
      content: "入力が正しくありません。",
    });
    return;
  }
  const resultEmbed = ndnDice(input);
  await interaction.reply({ embeds: [resultEmbed] });
}

export function ndnDice(ndn) {
  //最初に補正値を見る
  const modifierPattern = /([+-]\d+)$/;
  const modifierMatch = ndn.match(modifierPattern);
  const modifier = modifierMatch ? parseInt(modifierMatch[0], 10) : 0;
  const ndnWithoutModifier = modifierMatch
    ? ndn.replace(modifierMatch[0], "")
    : ndn; //補正値を除去
  const ModifierDisplay =
    modifier > 0 ? `+${modifier}` : modifier === 0 ? "" : `${modifier}`;

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
    return new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("そんなダイス振らないにゃ");
  }

  for (let i = 0; i < number; i++) {
    const dice = Math.floor(Math.random() * sides) + 1;
    sum += dice;
    result.push(dice);
  }

  const embed = new EmbedBuilder().setTitle(
    `${number}d${sides}${ModifierDisplay}`
  );

  if (number == 1 && sides == 100 && modifier == 0) {
    let description = `-->${sum}`;
    //1d100であればクリティカル、ファンブルの判定もする
    if (sum < 6) {
      description += "**(クリティカル！)**";
      embed.setColor(0x0000ff);
    } else if (sum > 95) {
      description += "**(ファンブル！)**";
      embed.setColor(0xff0000);
    } else {
      embed.setColor(0x00ff00);
    }
    embed.setDescription(description);
  } else if (modifier === 0) {
    // 結果の表示
    let description = `--> ${result.join(", ")}\n合計: ${sum}`;
    embed.setDescription(description);
    embed.setColor(0x00ff00);
  } else {
    const total = sum + modifier;
    let description = `--> ${result.join(
      ", "
    )}\n合計: ${sum} ${ModifierDisplay} >> ${total}`;
    embed.setDescription(description);
    embed.setColor(0x00ff00);
  }
  return embed;
}
