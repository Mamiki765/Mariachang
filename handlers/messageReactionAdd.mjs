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
  else if (reaction.emoji.id === '1237471008500224020'){
    let soudane
    if(!reaction.count){//キャッシュされてなければ取得
      soudane = await reaction.count.fetch();
    }else {
      soudane = reaction.count
    }
    console.log(soudane);
  }
};