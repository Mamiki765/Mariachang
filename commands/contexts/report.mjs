import { ContextMenuCommandBuilder,  ApplicationCommandType, EmbedBuilder,  ButtonBuilder, ButtonStyle ,ActionRowBuilder} from "discord.js";
import config from "../../config.mjs"

export const data = new ContextMenuCommandBuilder()
  .setName("このメッセージを報告(準備中)")
  .setType(ApplicationCommandType.Message);

export async function execute(interaction) {
  const confirmreport = new ButtonBuilder()
    .setCustomId("confirm_report")
    .setEmoji('✅')
    .setLabel("報告する")
    .setStyle(ButtonStyle.Danger);

  const cancelreport = new ButtonBuilder()
    .setCustomId("cancel_report")
    .setEmoji('❌')
    .setLabel("キャンセル")
    .setStyle(ButtonStyle.Secondary);

  if (!interaction.guild) return; 
    if (!interaction.guild) return;
 		const { channel } = interaction;
    		const message = interaction.options.getMessage("message")
    		if (message.system) return interaction.reply({
    			content: "システムメッセージは通報ができません。",
    			ephemeral: true
    		});
  const row = new ActionRowBuilder().addComponents(confirmreport, cancelreport);

  const response = await interaction.reply({
    flags: [ 4096 ],//silent
    ephemeral: true,
    content: "## :warning:必ず読んでください。\n```\nこのチャンネルとメッセージのコピーを管理人室に送信します。\n- 喧嘩や空気の悪化などの際にご利用ください。\n- 悪戯や個人的な不快感での通報はご遠慮ください。\n- ブロック機能などで対応できる場合は、通報せずに他の方法をご検討ください。\n- 補足事項を付けたいときは、お問い合わせチャンネルからの報告をお願いします。\n```\n**管理人室に報告しますか？**",
    components: [row]
  });
  
  try {
    const collectorFilter = (i) => i.user.id === interaction.user.id;
    const collector = response.createMessageComponentCollector({
      filter: collectorFilter,
      time: 60000,
    });

    collector.on('collect', async (i) => {
      if (i.customId === 'confirm_report') {
        collector.stop(); // コレクターを停止
        const adminChannel = interaction.guild.channels.cache.get(config.logch.admin);

        if (adminChannel) {
          const embed = new EmbedBuilder()
            .setTitle('メッセージ報告')
            .setDescription(`:\n`)
            .setAuthor({ name: `報告者: ${interaction.user.displayName}(@${interaction.user.tag})`, iconURL: interaction.user.displayAvatarURL()})
            .setColor('#FF0000')
            .addFields(
                      {
                        name: "送信者",
                        value: `${message.author.globalName}`
                      },
                      {
                        name: "送信チャンネル",
                        value: `#${channel.name} (<#${channel.id}>)`
                      },
                      {
                        name: "メッセージ",
                        value: `#${channel.name} (<#${channel.id}>)`
                      });
          
          await adminChannel.send({ embeds: [embed] });
          await interaction.editReply({
            content: "報告が送信されました。",
            components: [],
          });
        } else {
          await interaction.editReply({
            content: "管理人室チャンネルが見つかりませんでした。お手数をおかけしますがお問い合わせよりご報告願います。",
            components: [],
          });
        }
      } else if (i.customId === 'cancel_report') {
        collector.stop(); // コレクターを停止

        await interaction.editReply({
          content: "報告がキャンセルされました。",
          components: [],
        });
        return;
      }
    });

    collector.on('end', (collected, reason) => {
      if (reason === 'time') {
        interaction.editReply({
          content: "タイムアウトか発生しました。お手数をおかけしますがもう一度送信してください。",
          components: [],
        });
      }
    });
  } catch (e) {
    await interaction.editReply({
      content: "エラーが発生しました。お手数をおかけしますがお問い合わせよりご報告願います。",
      components: [],
    });
  }
  
}