import { SlashCommandBuilder ,  EmbedBuilder} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("laplace")
  .setDescription("ラプラスの箱を１１個開けます");

export async function execute(interaction) {
  // HQ3０　R22０ N735　C15
  const arr = ["### HQ　かつおぶしブレード","R  ドトールくん人形"　, "N  チョコミントの葉","__C  デス植木鉢__"];
  const weight = [30,220,735,15];
  let result = "";

  let totalWeight = 0;
  for (let i = 0; i < weight.length; i++) {
    totalWeight += weight[i];
  }
  for (let j = 1; j < 12; j++) {
    let random = Math.floor(Math.random() * totalWeight);
    　　　//result += random + "  ";
    for (let i = 0; i < weight.length; i++) {
      if (random < weight[i]) {
        result += arr[i] + "\n";
        break;
      } else {
        random -= weight[i];
      }
    }
  }  
  
    const embed = new EmbedBuilder()
      .setColor(0xEFDCAA)
      .setAuthor({ name: interaction.member.displayName, iconURL: interaction.member.displayAvatarURL()})
      .setTitle(`ひめこガチャ11連の結果にゃ！`)
      .setDescription(result)
      .setFooter({text: "（ロスアカラプラス仕様）"})
  
  await interaction.reply({
    flags: [ 4096 ],//silent
    embeds: [embed]
    });
}
