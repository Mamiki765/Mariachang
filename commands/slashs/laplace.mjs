import { SlashCommandBuilder ,  EmbedBuilder} from "discord.js";
import fs from "fs";

export const data = new SlashCommandBuilder()
  .setName("laplace")
  .setDescription("ラプラスの箱を１１個開けます");

export async function execute(interaction) {
  // C15　N735 R22０　HQ3０　 1000倍して悪い順に
  const arr = ["__C__  ", "N  "　, "R  ","### HQ　"];
//240727追加　各レアリティごとのファイルを読み込む
  const map0 = fs.readFileSync("./maps/cursed.txt", 'utf8');
  const map1 = fs.readFileSync("./maps/novice.txt", 'utf8');
  const map2 = fs.readFileSync("./maps/regular.txt", 'utf8');
  const map3 = fs.readFileSync("./maps/HighQuality.txt", 'utf8');
  const maps = [];
  maps[0] = map0.split(/\n/);
  maps[1] = map1.split(/\n/);
  maps[2] = map2.split(/\n/);
  maps[3] = map3.split(/\n/);
//ここまで
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
        result += arr[i] + maps[i][Math.floor(Math.random() * maps[i].length)] + "\n";　//結果を付け足して次に
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
      .setFooter({text: "アイテム案は随時募集中にゃ！（ロスアカラプラス仕様）"})
  
  await interaction.reply({
    flags: [ 4096 ],//silent
    embeds: [embed]
    });
}
