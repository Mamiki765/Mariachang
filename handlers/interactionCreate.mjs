export default async(interaction) => {
//  左からスラッシュメニュー、コンテキストメニュー（右クリック）、テキスト入力interaction.isModalSubmit
  if (!interaction.isChatInputCommand() && !interaction.isMessageContextMenuCommand() && !interaction.isModalSubmit()) return;
	const command = interaction.client.commands.get(interaction.commandName);

  //console.log(interaction);//debug
	if (!command) {
		console.error(`「${interaction.commandName}」コマンドは見つかりませんでした。`);
		return;
	}

	try {
		await command.execute(interaction);
  //ログ取得ここから
      client.channels.cache.get(process.env.logch_login).send({
            embeds: [
                new EmbedBuilder()
                .setTitle("起動完了")
                .setDescription("> Botが起動しました。")
                .setColor("#B78CFE")
                .setTimestamp()
            ]
        });
  //ログ取得ここまで
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'コマンド実行中にエラーが発生しました。', ephemeral: true });
		} else {
			await interaction.reply({ content: 'コマンド実行中にエラーが発生しました。', ephemeral: true });
		}
	}
};
