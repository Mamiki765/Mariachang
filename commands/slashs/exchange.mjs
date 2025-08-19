// commands\slashs\exchange.mjs
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import axios from "axios";
import { sequelize, Point } from "../../models/database.mjs";
import config from "../../config.mjs";

export const data = new SlashCommandBuilder()
  .setName("exchange")
  .setNameLocalizations({ ja: "経済" }) // 名前も「為替」から「経済」のように、より広い意味に
  .setDescription("通貨やポイントの確認、両替などを行います。")

  // サブコマンド: forex (為替)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("forex")
      .setDescription("現実世界の主要通貨の為替レートを表示します。(対JPY)")
  )

  // サブコマンド: balance (残高)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("balance")
      .setDescription("あなたの所持ポイント、どんぐり、コインを表示します。")
  )

  // サブコマンドグループ: transfer (両替)
  .addSubcommandGroup((group) =>
    group
      .setName("transfer")
      .setDescription("ポイントやどんぐりをコインに両替します。")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("points")
          .setDescription("RPをコインに両替します (レート: 1 RP → 20コイン)")
          .addIntegerOption((option) =>
            option
              .setName("amount")
              .setDescription("両替したいRPの量")
              .setRequired(true)
              .setMinValue(1)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("acorns")
          .setDescription(
            "どんぐりをコインに両替します (レート: 1どんぐり → 100コイン)"
          )
          .addIntegerOption((option) =>
            option
              .setName("amount")
              .setDescription("両替したいどんぐりの数")
              .setRequired(true)
              .setMinValue(1)
          )
      )
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const subcommandGroup = interaction.options.getSubcommandGroup();
  //為替を見る
  if (subcommand === "forex") {
    await interaction.deferReply({});
    await executeForex(interaction);
  } else if (subcommand === "balance") {
    await interaction.deferReply({ flags: 64 });
    // ここに、「財布を見る」ロジックを書く
    await executeBalance(interaction);
  } else if (subcommandGroup === "transfer") {
    await interaction.deferReply({ flags: 64 });
    const amount = interaction.options.getInteger("amount");
    const userId = interaction.user.id;

    try {
      // 1. トランザクションを開始
      const resultMessage = await sequelize.transaction(async (t) => {
        // 2. ユーザーデータを取得 (必ずトランザクション内で！)
        const [user] = await Point.findOrCreate({
          where: { userId },
          defaults: { userId },
          transaction: t, // このトランザクションの一部であることを明記
        });

        // 3. どの通貨を両替するかに応じて処理を分岐
        if (subcommand === "points") {
          // 3a. バリデーション: RPが足りるか？
          if (user.point < amount) {
            // エラーを投げると、トランザクションは自動でロールバック(中止)される
            throw new Error("所持しているRPが足りません！");
          }

          // 4a. 計算とDB更新
          const coinsGained = amount * 20;
          user.point -= amount;
          user.coin += coinsGained;

          // 5. 変更を保存 (これもトランザクション内で)
          await user.save({ transaction: t });

          // 6. 成功メッセージを返す
          return `💎 RP **${amount}** を ${config.nyowacoin} コイン **${coinsGained}** 枚に両替しました！`;
        } else if (subcommand === "acorns") {
          // 3b. バリデーション: どんぐりが足りるか？
          if (user.acorn < amount) {
            throw new Error("所持しているどんぐりが足りません！");
          }

          // 4b. 計算とDB更新
          const coinsGained = amount * 100;
          user.acorn -= amount;
          user.coin += coinsGained;

          // 5.
          await user.save({ transaction: t });

          // 6.
          return `🐿️ どんぐり **${amount}** 個を ${config.nyowacoin} コイン **${coinsGained}** 枚に両替しました！`;
        }
      });

      // ✅ トランザクションが全て成功した場合
      await interaction.editReply(`✅ **両替成功！**\n${resultMessage}`);
    } catch (error) {
      // ❌ バリデーションエラーや、その他のDBエラーが起きた場合
      console.error("両替処理中にエラー:", error);
      await interaction.editReply(
        `❌ **エラーが発生しました**\n${error.message}`
      );
    }
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

//残高を見る
async function executeBalance(interaction) {
  const userId = interaction.user.id;
  try {
    const [user] = await Point.findOrCreate({
      where: { userId },
      defaults: { userId },
    });

    const embed = new EmbedBuilder()
      .setTitle(`👛 ${interaction.user.username} さんの財布`)
      .setColor("#FEE75C") // 黄色っぽい色
      .addFields(
        {
          name: "💎 ロールプレイ",
          value: `**${user.point}**RP`,
          inline: false,
        },
        {
          name: "🐿️ あまやどんぐり",
          value: `**${user.acorn}**個`,
          inline: false,
        },
        {
          name: `${config.nyowacoin} ニョワコイン`,
          value: `**${user.coin}**枚`,
          inline: false,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("残高の取得中にエラー:", error);
    await interaction.editReply("残高の取得に失敗しました。");
  }
}
