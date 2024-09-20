import { EmbedBuilder } from "discord.js";

import config from '../config.mjs'; 
//新規ギルドに登録時の処理


export default async(guild,client) => {
        const addEmbed = new EmbedBuilder()
            .setTitle("サーバー追加")
            .setDescription(`${guild.name}(${guild.id})にBotが追加されました。`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .setTimestamp();
        const logChannel = client.channels.cache.get(config.logch.guildCreate);
        if (logChannel) {
            logChannel.send({ embeds: [addEmbed] }).catch(console.error);
        } else {
            console.error('ログチャンネルが見つかりませんでした。');
        }
};

/*
処理ここまで、以下サブルーチン
*/