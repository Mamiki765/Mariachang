import { SlashCommandBuilder ,  EmbedBuilder} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("laplace")
  .setDescription("ラプラスの箱を１１個開けます");

export async function execute(interaction) {
  // C15　N735 R22０　HQ3０　 1000倍して悪い順に
  const arr = ["__C__  ", "N  "　, "R  ","### HQ　"];
  const weight = [15,735,220,30];
  let result = "";
//確率を足して
  let totalWeight = 0;
  for (let i = 0; i < weight.length; i++) {
    totalWeight += weight[i];
  }
//11連する
  for (let j = 1; j < 12; j++) {
    let random = Math.floor(Math.random() * totalWeight); 
    //result += random + "  ";　　//乱数確認用
    for (let i = 0; i < weight.length; i++) {　
      if (random < weight[i]) {　　//レアリティ決定
        result += arr[i] + "\n";　//結果を付け足して次に
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
