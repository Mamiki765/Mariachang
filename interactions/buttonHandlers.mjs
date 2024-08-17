import { deleteconfirm　} from "../components/buttons.mjs"

export default async function handleButtonInteraction(interaction) {
      //削除ボタン
       if (interaction.customId == "delete" || interaction.customId == "deleteanyone" ) {
       if(!interaction.message.mensions){
        await interaction.message.fetch();
       }//なければ取得
         //削除ボタンを押されたとき、消せる人がanyoneでないならその本文の文頭にあるメンションの人を投稿者として認識、削除権限の有無を確かめる。
         const userIdPattern = new RegExp(`^<@${interaction.user.id}>`, 'i'); //自分宛てへのメンションで始まるメッセージなら投稿者
         if (userIdPattern.test(interaction.message.content) || interaction.customId == "deleteanyone") {
           //確認メッセージを送信
          await interaction.reply({
            content: 'このメッセージを削除しますか？',
            components: [deleteconfirm],
            ephemeral: true
            });
          return;
          }else{//削除権限無し
          await interaction.reply({content: 'このメッセージを削除できるのは投稿者のみです。', ephemeral: true});
          return;
          }
         }else if (interaction.customId === 'confirm_delete') {
          // メッセージを削除する処理
          const messageToDelete = await interaction.channel.messages.fetch(interaction.message.reference.messageId);// 削除するメッセージを取得
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
  
    else{//ボタンが不明のとき
      return; 
  }
  
};