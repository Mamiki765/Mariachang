import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getWebhookInChannel, getWebhook } from "../../utils/webhook.mjs";
import { Character, Icon } from '../../models/roleplay.mjs';

//権利表記の特定部分をIL名で置き換えて権利表記を生成するためのパーツ
const illustratorname = 'illustratorname';

export const data = new SlashCommandBuilder()
  .setName("roleplay")
  .setDescription("ロールプレイに関する内容")
  // 登録
  .addSubcommand(subcommand =>
    subcommand
      .setName("register")
      .setDescription("ロールプレイをするキャラを登録します。")
      .addStringOption(option =>
        option
          .setName('chara')
          .setDescription('キャラクター名')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('pbw')
          .setDescription('アイコンの権利表記フォーマット')
          .addChoices(
            { name: 'ロスト・アーカディア', value: 'rev2' },
            { name: 'PandoraPartyProject', value: 'rev1' },
            { name: 'チェインパラドクス', value: 'tw7' },
            { name: '第六猟兵', value: 'tw6' },
            { name: 'アルパカコネクト（ワールド名は別途記載！）', value: 'alpaca' },
            { name: 'その他（権利表記は自分で書く）', value: 'other' },
          )
          .setRequired(true)
      )
      .addAttachmentOption(option =>
        option.setName('icon')
          .setDescription('アイコンをアップロードできます')
      )
      .addStringOption(option =>
        option
          .setName('illustrator')
          .setDescription('投稿アイコンのイラストレーター様(その他選択時は不要)')
      )
      .addStringOption(option =>
        option
          .setName('world')
          .setDescription('【アルパカコネクト社のみ】所属ワールドをどうぞ')
      )
      .addStringOption(option =>
        option
          .setName('権利表記')
          .setDescription('【その他選択時のみ】権利表記を記載してください。末尾にby（表示名)がつきます。')
      )
  )
  // 発言
  .addSubcommand(subcommand =>
    subcommand
      .setName("post")
      .setDescription("登録したキャラデータと最後に使用したアイコンでRPします。")
      .addStringOption(option =>
        option
          .setName('message')
          .setDescription('発言内容を記述(改行は\n、<br>、@@@などでもできます)')
          .setRequired(true)
      )
      .addAttachmentOption(option =>
        option.setName('icon')
          .setDescription('アイコンを変更する時はこちら（別ILのアイコンにした時は権利表記オプションもつけること！）')
      )
      .addStringOption(option =>
        option
          .setName('illustrator')
          .setDescription('（アイコンのILを変えたときのみ）IL名、権利表記を自分で書く時はフルで')
      )
  )
  // 表示
  .addSubcommand(subcommand =>
    subcommand
      .setName("display")
      .setDescription("登録したキャラデータを表示します。")
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "register") {
    const name = interaction.options.getString('chara');
    const pbw = interaction.options.getString('pbw');
    const icon = interaction.options.getAttachment("icon");
    const world = interaction.options.getString("world");
    const illustrator = interaction.options.getString('illustrator') || "絵師様";
    const copyright = interaction.options.getString('権利表記')　|| "";

    const iconUrl = icon ? icon.attachment : null;
    let pbwflag = null;
    if (pbw === "rev1") {
      pbwflag = `『PandoraPartyProject』(c)<@${interaction.user.id}>/illustratorname/Re:version`;
    } else if (pbw === "rev2") {
      pbwflag = `『ロスト・アーカディア』(c)<@${interaction.user.id}>/illustratorname/Re:version`;
    } else if (pbw === "tw6") {
      pbwflag = `『第六猟兵』(c)<@${interaction.user.id}>/illustratorname/トミーウォーカー`;
    } else if (pbw === "tw7") {
      pbwflag = `『チェインパラドクス』(c)<@${interaction.user.id}>/illustratorname/トミーウォーカー`;
    } else if (pbw === "alpaca") {
      pbwflag = `illustratorname/${world}/(C)アルパカコネクト by <@${interaction.user.id}>`;
    } else if (pbw === "other") {
      pbwflag = `illustratorname by <@${interaction.user.id}>`;
    }

    try {
      await Character.upsert({ userId: interaction.user.id, name: name, pbwflag: pbwflag });
      if(pbw !== "other"){
        await Icon.upsert({ userId: interaction.user.id, iconUrl: iconUrl ,illustrator: illustrator, pbw: pbw});
      }else{
        await Icon.upsert({ userId: interaction.user.id, iconUrl: iconUrl ,illustrator: copyright, pbw: pbw}); //${copyright}が代わりに入る
      }
      const checkchara = await Character.findOne({ where: { userId: interaction.user.id } });
      const checkicon = await Icon.findOne({ where: { userId: interaction.user.id } });

      console.log('Character Data:', checkchara);
      console.log('Icon Data:', checkicon);
      interaction.reply({ flags: [4096], content: `キャラデータを登録しました`, ephemeral: true });
    } catch (error) {
      console.error('キャラ登録に失敗しました。:', error);
      interaction.reply({ flags: [4096], content: `キャラ登録でエラーが発生しました。`, ephemeral: true });
    }

  } else if (subcommand === "post") {
    let message = interaction.options.getString('message');
    const icon = interaction.options.getAttachment("icon");
    const illustrator = interaction.options.getString('illustrator');
    let name = null, pbwflag = null, face = null,copyright = null, loadchara = null, loadicon = null, flags = null;

    try {
      loadchara = await Character.findOne({ where: { userId: interaction.user.id } });
      loadicon = await Icon.findOne({ where: { userId: interaction.user.id } });
    } catch (error) {
      console.error('キャラデータのロードに失敗しました:', error);
      interaction.reply({ flags: [4096], content: `キャラデータのロードでエラーが発生しました。`, ephemeral: true });
      return;
    }

    if (!loadchara) {
      interaction.reply({ flags: [4096], content: `キャラデータがありません。`, ephemeral: true });
      return;
    }

    name = loadchara.name;
    pbwflag = loadchara.pbwflag;
    copyright = loadicon.illustrator
    if (icon) {
      face = icon.attachment;
      // 新しいアイコンがアップロードされた場合は、データベースを更新
    if(illustrator !== null){
      //IL名があれば更新
      copyright = illustrator
    }
    try {
      await Icon.upsert({ userId: interaction.user.id, iconUrl: face ,illustrator: copyright, pbw: loadicon.pbw});
    } catch (error) {
      console.error('アイコンの更新に失敗しました:', error);
      interaction.reply({ flags: [4096], content: `アイコンの更新でエラーが発生しました。`, ephemeral: true });
      return;
    }
    } else {
      face = loadicon ? loadicon.iconUrl : null;
    }
    // `illustratorname` が `pbwflag` に含まれているか確認します。
    if (pbwflag.includes(illustratorname)) {
      // `illustratorname` を `copyright` で置き換えます。
      pbwflag = pbwflag.replace(illustratorname, copyright);
      console.log('Updated pbwflag:', pbwflag);
    } else {
      // `illustratorname` が含まれていない場合はエラーとして返します。
      interaction.reply({ flags: [4096], content: `大変お手数をおかけしますが、再度キャラを登録し直してください`, ephemeral: true });
      return;
    }

    message = message
      .replace(/@@@/g, '\n')
      .replace(/<br>/g, '\n')
      .replace(/\\n/g, '\n');
    message = message + "\n" + `-# ` + pbwflag;

    try {
      let webhook = null;
      let Threadid = null;
      if (!interaction.channel.isThread()) {
        webhook = await getWebhookInChannel(interaction.channel);
      } else {
        webhook = await getWebhookInChannel(interaction.channel.parent);
        Threadid = interaction.channel.id;
      }

      //連投確認
      const messages = await interaction.channel.messages.fetch({ limit: 2 });
      const lastMessage = messages.first();
      if (lastMessage) {
        const now = Date.now();
        const lastMessageTime = lastMessage.createdTimestamp;
        const isRecent = (now - lastMessageTime) <= 10 * 60 * 1000; // 10分以内
        const isWebhook = lastMessage.webhookId != null;
        const isSilent = lastMessage.flags.has(4096); // 4096はサイレントメッセージのフラグ

      if (isRecent && isWebhook && !isSilent) {
        flags = [4096];
      }
    }
      
      webhook.send({
        content: message,
        username: name,
        threadId: Threadid,
        avatarURL: face,
        flags : flags
      });

      interaction.reply({ flags: [4096], content: `送信しました`, ephemeral: true });
    } catch (error) {
      console.error('メッセージ送信に失敗しました:', error);
      interaction.reply({ flags: [4096], content: `エラーが発生しました。`, ephemeral: true });
    }

  } else if (subcommand === "display") {
    try {
      const loadchara = await Character.findOne({ where: { userId: interaction.user.id } });
      const loadicon = await Icon.findOne({ where: { userId: interaction.user.id } });

      if (!loadchara) {
        await interaction.reply({ flags: [4096], content: `キャラデータがありません。`, ephemeral: true });
        return;
      }

      const { name, pbwflag } = loadchara;
      const iconUrl = loadicon ? loadicon.iconUrl : null;
      const replace = "__" + loadicon.illustrator + "__";
      const copyright = pbwflag.replace(illustratorname, replace);

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(name || 'キャラクター名がありません')
        .setDescription(copyright || 'フッターが設定されていません')
        .setThumbnail(iconUrl || 'https://via.placeholder.com/150')
        .setFooter({ text: `登録者: ${interaction.user.username} IL名変更の時は下線部が変更されます。` });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error('キャラデータの表示に失敗しました:', error);
      await interaction.reply({ flags: [4096], content: `キャラデータの表示でエラーが発生しました。`, ephemeral: true });
    }
  }
}