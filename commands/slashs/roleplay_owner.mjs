import { SlashCommandBuilder, PermissionsBitField} from 'discord.js';
import {getWebhookInChannel , getWebhook} from "../../utils/webhook.mjs"

const choicesArray = (process.env.webhook_name || '').split(',');
const namesArray = (process.env.webhook_displayname || '').split(',');
const urlsArray = (process.env.webhook_url || '').split(',');

// 選択肢を適切な形式に変換する
const choices = choicesArray.map(choice => ({
  name: choice,
  value: choice
}));

export const data = new SlashCommandBuilder()
  .setName("roleplay_owner")
  .setDescription("bot所有者専用")
// 管理者権限のみで実行可能
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator.toString())
  .addStringOption(option =>
                option.setName('chara')
                    .setDescription('キャラクターを選択')
                    .addChoices(...choices)
                    .setRequired(true)
            )
  .addStringOption(option =>
        option
          .setName('message')
          .setDescription('発言内容を記述(改行は\n、<br>、@@@などでもできます)')
          .setRequired(true)
    )   

export async function execute(interaction){

  const chara = interaction.options.getString('chara');
  let message = interaction.options.getString('message');
    // 改行文字を置き換え
    message  = message
      .replace(/@@@/g, '\n')
      .replace(/<br>/g, '\n')
      .replace(/\\n/g, '\n');
  if(interaction.user.id !== process.env.OWNER_ID){
    interaction.reply({flags: [ 4096 ],　content: `この機能はbotオーナー専用です`,ephemeral: true});    
    return;
  }
  try{
    const index =　choicesArray.indexOf(chara);
  //Webhookの取得（なければ作成する）
  let webhook = null;
  let Threadid = null;
  //スレッドであるかチェックし、スレッドなら親チャンネルのwebhookを用いてスレッドに投稿する形を取る
  if(!interaction.channel.isThread()){
      webhook = await getWebhookInChannel(interaction.channel);
    }else{
      webhook = await getWebhookInChannel(interaction.channel.parent);
      Threadid = interaction.channel.id
    }
    webhook.send({
     content: message,
     username : namesArray[index],
     threadId: Threadid ,
     avatarURL : urlsArray[index],
   });
    interaction.reply({flags: [ 4096 ],　content: `ok!`,ephemeral: true});
  } catch(error){
    console.error('メッセージ送信に失敗しました:', error);
    interaction.reply({flags: [ 4096 ],　content: `error!`,ephemeral: true});
  }
//}
}