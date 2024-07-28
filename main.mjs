import fs from "fs";
import path from "path";
import express from "express";
import { Client, Collection, Events, GatewayIntentBits, ActivityType,  EmbedBuilder } from "discord.js";
import CommandsRegister from "./regist-commands.mjs";
import Notification from "./models/notification.mjs";

import Sequelize from "sequelize";
import Parser from 'rss-parser';
import cron from 'node-cron';
const parser = new Parser();


let postCount = 0;
const app = express();
app.listen(3000);
app.post('/', function(req, res) {
  console.log(`Received POST request.`);
  postCount++;
  if (postCount == 10) {
    postCount = 0;
  }
  
  res.send('POST response by glitch');
})
app.get('/', function(req, res) {
  res.send('<a href="https://note.com/exteoi/n/n0ea64e258797</a> に解説があります。');
})

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
  ],
});

client.commands = new Collection();

const categoryFoldersPath = path.join(process.cwd(), "commands");
const commandFolders = fs.readdirSync(categoryFoldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(categoryFoldersPath, folder);
  const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".mjs"));
  
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    import(filePath).then((module) => {
      client.commands.set(module.data.name, module);
    });
  }
}

const handlers = new Map();

const handlersPath = path.join(process.cwd(), "handlers");
const handlerFiles = fs.readdirSync(handlersPath).filter((file) => file.endsWith(".mjs"));

for (const file of handlerFiles) {
  const filePath = path.join(handlersPath, file);
  import(filePath).then((module) => {
    handlers.set(file.slice(0, -4), module);
  });
}

client.on("interactionCreate", async (interaction) => {
  await handlers.get("interactionCreate").default(interaction);
//ログはとっておく
  const log = new EmbedBuilder()
        .setTitle("コマンド実行ログ")
        .setDescription(`${interaction.member.displayName} がコマンドを実行しました。`)
        .setTimestamp()
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .addFields(
                {
                    name: "コマンド",
                    value: "```\n" + interaction.toString() + "\n```"
                },
                {
                    name: "実行ユーザー",
                    value: "```\n" + `${interaction.user.tag}(${interaction.user.id})` + "\n```",
                    inline: true
                }
            )
    client.channels.cache.get(process.env.logch_command).send({ embeds: [log] })
//ログ取りここまで
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  await handlers.get("voiceStateUpdate").default(oldState, newState);
});

client.on("messageCreate", async (message) => {
  if (message.author.id == client.user.id || message.author.bot) return;
  await handlers.get("messageCreate").default(message);
});

client.on("ready", async () => {
  //時報テスト
  const timechannel = await client.channels.fetch(process.env.time_signal_channel)
  await cron.schedule('0 8,22 * * *', () => {
     timechannel.send(`${new Date().getHours()} 時になりました。`)
   })
   //時報テストここまで
  await client.user.setActivity('🍙', { type: ActivityType.Custom, state: "今日も雨宿り中" });
  console.log(`${client.user.tag} がログインしました！`);
  //240718管理室にログイン通知
    client.channels.cache.get(process.env.logch_login).send({
            embeds: [
                new EmbedBuilder()
                .setTitle("起動完了")
                .setDescription("> Botが起動しました。")
                .setColor("#B78CFE")
                .setTimestamp()
            ]
        });
  //ログイン通知ここまで
});


Notification.sync({ alter: true });

CommandsRegister();
client.login(process.env.TOKEN);

