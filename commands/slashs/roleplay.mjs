import { SlashCommandBuilder} from 'discord.js';
import {getWebhookInChannel , getWebhook} from "../../utils/webhook.mjs"
import keyv from "keyv";



export const data = new SlashCommandBuilder()
  .setName("roleplay")
  .setDescription("ロールプレイが出来たりします（β版）")
  .addStringOption(option =>
                option
                    .setName('chara')
                    .setDescription('キャラクター名')
                    .setRequired(true)
            )
  .addStringOption(option =>
                option
                    .setName('pbw')
                    .setDescription('所属PBW')
                    .addChoices(
              	      {name:'ロスト・アーカディア', value:'rev2'},
              	      {name:'PandoraPartyProject', value:'rev1'},
                      {name:'チェインパラドクス', value:'tw7'},
                      {name:'第六猟兵', value:'tw6'},
                      {name:'アルパカコネクト（ワールド名は別途記載！）', value:'alpaca'},
     {name:'その他(投稿者のみ)', value:'other'},
                    )
                    .setRequired(true)
            )
  .addStringOption(option =>
        option
          .setName('message')
          .setDescription('発言内容を記述(改行は\n、<br>、@@@などでもできます)')
          .setRequired(true)
    )
	    .addAttachmentOption(option =>
		option.setName('icon')
			.setDescription('アイコンをアップロードできます')
			)
      .addStringOption(option =>
        option
          .setName('illustrator')
          .setDescription('アイコンのイラストレーター様')
    )
      .addStringOption(option =>
        option
          .setName('world')
          .setDescription('【アルパカコネクト社のみ】所属ワールドをどうぞ')
    )

export async function execute(interaction){
  const chara = interaction.options.getString('chara');
  const pbw = interaction.options.getString('pbw');
  let message = interaction.options.getString('message');
	const icon =interaction.options.getAttachment("icon");
	const world =interaction.options.getString("world");
  const illustrator = interaction.options.getString('illustrator')　|| "絵師様";
  //PBWごとの権利表記
  let pbwflag = null;
  if(pbw === "rev1"){
    pbwflag = `『PandoraPartyProject』(c)${interaction.user.displayName}/${illustrator}/Re:version`;
  }else if(pbw === "rev2"){
    pbwflag = `『ロスト・アーカディア』(c)${interaction.user.displayName}/${illustrator}/Re:version`;
  }else if(pbw === "tw6"){
    pbwflag = `『第六猟兵』(c)${interaction.user.displayName}/${illustrator}/トミーウォーカー`;
  }else if(pbw === "tw7"){
    pbwflag = `『チェインパラドクス』(c)${interaction.user.displayName}/${illustrator}/トミーウォーカー`;
  }else if(pbw === "alpaca"){
    pbwflag = `${illustrator}/${world}/(C)アルパカコネクト by ${interaction.user.displayName}`;
  }else if(pbw === "other"){
    pbwflag = `by ${interaction.user.displayName}`;
  }
    // 改行文字を置き換え
    message  = message
      .replace(/@@@/g, '\n')
      .replace(/<br>/g, '\n')
      .replace(/\\n/g, '\n');
    message = message + "\n" + `-# ` + pbwflag;
  try{
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
     username : chara,
     threadId: Threadid ,
     avatarURL : icon.attachment,
   });
    interaction.reply({flags: [ 4096 ],　content: `送信しました`,ephemeral: true});
  } catch(error){
    console.error('メッセージ送信に失敗しました:', error);
    interaction.reply({flags: [ 4096 ],　content: `エラーが発生しました。`,ephemeral: true});
  }
}