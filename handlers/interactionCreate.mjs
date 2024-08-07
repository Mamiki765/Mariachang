export default async(interaction) => {
  if (interaction.isButton()){//ボタンだった場合
       if (interaction.customId == "delete") {//コマンドについてくるボタンが削除ボタンだった場合
         if(interaction.message.mentions.users.has(interaction.member.user.id)) {
           interaction.message.delete()//メッセージ削除
           }
         }
       }
//  スラッシュメニュー、コンテキストメニュー（右クリック）であるか確認。
  if (!interaction.isChatInputCommand() && !interaction.isMessageContextMenuCommand()) return;
	const command = interaction.client.commands.get(interaction.commandName);

  //console.log(interaction);//debug
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
