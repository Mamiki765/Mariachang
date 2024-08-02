export default async(reaction, user) => {
  if (reaction.emoji.id === '1267692767489036390'){//削除を押されたら
    console.log(reaction.message);
    if(reaction.message.content.includes(user.id)){
      await reaction.message.delete();
    }
  }
};