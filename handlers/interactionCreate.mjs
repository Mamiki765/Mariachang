import { ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';

export default async(interaction) => {
//ボタン
  if (interaction.isButton()){
    //deleteなら削除ボタン処理
       if (interaction.customId == "delete") {
         //ボタンを押した人がメンションをした人or誰にもメンションがついてないなら
         if(interaction.message.mentions.users.has(interaction.member.user.id) || interaction.message.mentions.members.size === 0) {
           //確認メッセージを送信
          const confirmationButton = new ButtonBuilder()
            .setCustomId('confirm_delete')
            .setLabel('削除する')
            .setStyle(ButtonStyle.Danger);
          const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_delete')
            .setLabel('キャンセル')
            .setStyle(ButtonStyle.Secondary);
          const row = new ActionRowBuilder().addComponents(confirmationButton, cancelButton);

          await interaction.reply({
            content: 'このメッセージを削除しますか？',
            components: [row],
            ephemeral: true
            });
          return;
          }else{//削除権限無し
          await interaction.reply({content: 'このメッセージを削除できるのは投稿者のみです。', ephemeral: true});
          return;    
          }
         }else if (interaction.customId === 'confirm_delete') {
          // メッセージを削除する処理
          const messageToDelete = await interaction.channel.messages.fetch(interaction.message.id); // 削除するメッセージの取得（ここではオリジナルメッセージを削除）
          if (messageToDelete) {
            await messageToDelete.delete();
            await interaction.update({ content: 'メッセージが削除されました。', components: [] });
          } else {
            await interaction.update({ content: 'メッセージが見つかりませんでした。', components: [] });
          }
          return;
        }else if (interaction.customId === 'cancel_delete') {
          await interaction.update({ content: '削除がキャンセルされました。', components: [] });
          return;
    }
  }
//  スラッシュメニュー、コンテキストメニュー（右クリック）であるか確認。
  else if (!interaction.isChatInputCommand() && !interaction.isMessageContextMenuCommand()) return;
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
