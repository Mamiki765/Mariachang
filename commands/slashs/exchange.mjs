// commands\slashs\exchange.mjs
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import axios from "axios";
import { sequelize, Point } from "../../models/database.mjs";
import config from "../../config.mjs";

export const data = new SlashCommandBuilder()
  .setName("exchange")
  .setNameLocalizations({ ja: "為替" }) 
  .setDescription("現実世界の主要通貨の為替レートを表示します。(対JPY)")

  // サブコマンド: forex (為替)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("forex")
      .setDescription("現実世界の主要通貨の為替レートを表示します。(対JPY)")
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const subcommandGroup = interaction.options.getSubcommandGroup();
  //為替を見る
  if (subcommand === "forex") {
    await interaction.deferReply({});
    await executeForex(interaction);
  }
}

//為替をみる機能
async function executeForex(interaction) {
  try {
    const { data } = await axios.get(
      "https://exchange-rate-api.krnk.org/api/rate"
    );

    const embed = new EmbedBuilder()
      .setTitle("💱 現在の為替レート（対JPY）")
      .setDescription(
        `データ取得: <t:${Math.floor(new Date(data.datetime).getTime() / 1000)}:F>`
      )
      .addFields(
        { name: "🇺🇸 米ドル", value: `${data.USD_JPY}`, inline: true },
        { name: "🇪🇺 ユーロ", value: `${data.EUR_JPY}`, inline: true },
        { name: "🇬🇧 英ポンド", value: `${data.GBP_JPY}`, inline: true },
        { name: "🇦🇺 豪ドル", value: `${data.AUD_JPY}`, inline: true },
        { name: "🇳🇿 NZドル", value: `${data.NZD_JPY}`, inline: true },
        { name: "🇨🇦 カナダドル", value: `${data.CAD_JPY}`, inline: true },
        { name: "🇨🇭 スイスフラン", value: `${data.CHF_JPY}`, inline: true },
        { name: "🇹🇷 トルコリラ", value: `${data.TRY_JPY}`, inline: true },
        { name: "🇿🇦 南ｱﾌﾘｶﾗﾝﾄﾞ", value: `${data.ZAR_JPY}`, inline: true },
        { name: "🇲🇽 ﾒｷｼｺﾍﾟｿ", value: `${data.MXN_JPY}`, inline: true },
        {
          name: "<:nyowamiyarika:1264010111970574408> RC",
          value: `11.5`,
          inline: true,
        },
        { name: "⭐️ 星", value: `1166`, inline: true }
      )
      .setColor("#4FB4F4")
      .setFooter({ text: "KuronekoServerの情報を元に表示しています。" });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error(error);
    await interaction.editReply(
      "為替情報の取得に失敗しました。しばらくしてから再試行してください。"
    );
  }
}
