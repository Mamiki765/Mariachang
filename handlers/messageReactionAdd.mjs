export default async(reaction, user) => {
  //削除
  if (reaction.emoji.id === '1267692767489036390'){//削除を押されたら
    let message = reaction.message;
    //まずmessage.contentがあるかみる
    if(!message.content){
      message = await reaction.message.fetch();//なければ取得
    }
    if(message.content.includes(user.id)){
      await message.delete();
    }
  }
  //そうだね
  //240802フォーラムはNSFWを調べられない、さて、どうしようか……
  else if (reaction.emoji.id === '1237471008500224020'){
    if(!reaction.count){//キャッシュされてなければ取得
     await reaction.fetch();
      }
    const soudane = reaction.count
    if(reaction.message.author.bot){return;}
    if(reaction.message.reactions.cache.get('1236923430490734672')?.count){return;}
    if(soudane === 7){
      if(reaction.message.channel.nsfw){
        await reaction.message.reply(`そうだねが7以上に達したため<#1098172139414233108>にコピーされます。`);       
      }else{
        await reaction.message.reply(`そうだねが7以上に達したため<#1098159960942202941>にコピーされます。`);
      }
      await reaction.message.react('1236923430490734672');
    }
  }
　//hda
    else if (reaction.emoji.id === '1057293963813453914'){
    if(!reaction.count){//キャッシュされてなければ取得
     await reaction.fetch();
      }
    console.log(parent)
    if(reaction.message.author.bot){return;}
    if(!reaction.message.channel.nsfw){return;}
    const hda = reaction.count
    if(reaction.message.reactions.cache.get('1236923430490734672')?.count){return;}
    if(hda === 7){
        await reaction.message.reply(`えっちだが7以上に達したため<#1098172139414233108>にコピーされます。`);       
      await reaction.message.react('1236923430490734672');
    }
  }
};