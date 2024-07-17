export default async(interaction) => {
//  左からスラッシュメニュー、コンテキストメニュー（右クリック）、テキスト入力interaction.isModalSubmit
  if (!interaction.isChatInputCommand() && !interaction.isMessageContextMenuCommand() && !interaction.isModalSubmit()) return;
	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`「${interaction.commandName}」コマンドは見つかりませんでした。`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'コマンド実行中にエラーが発生しました。', ephemeral: true });
		} else {
			await interaction.reply({ content: 'コマンド実行中にエラーが発生しました。', ephemeral: true });
		}
	}
};
