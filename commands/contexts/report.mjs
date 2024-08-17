import { ContextMenuCommandBuilder,  ApplicationCommandType, EmbedBuilder,  ButtonBuilder, ButtonStyle ,ActionRowBuilder} from "discord.js";

export const data = new ContextMenuCommandBuilder()
  .setName("⚠️このメッセージを報告(準備中)")
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
  
}