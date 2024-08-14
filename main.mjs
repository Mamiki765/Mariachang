import fs from "fs";
import path from "path";
import express from "express";
import { Client, Collection, Events, GatewayIntentBits, ActivityType,  EmbedBuilder , Partials} from "discord.js";
import CommandsRegister from "./regist-commands.mjs";
import Notification from "./models/notification.mjs";

import Sequelize from "sequelize";
import Parser from 'rss-parser';
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
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildWebhooks,
  ],
	partials: [
		Partials.User,
		Partials.Channel,
		Partials.GuildMember,
		Partials.Message,
		Partials.Reaction,
//		Partials.GuildScheduledEvent,
		Partials.ThreadMember,
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

client.on("interactionCreate", async (interaction) => {//インタラクション時
  await handlers.get("interactionCreate").default(interaction);
});

client.on("voiceStateUpdate", async (oldState, newState) => {//ボイスチャンネルの状態変化
  await handlers.get("voiceStateUpdate").default(oldState, newState);
});

client.on("messageCreate", async (message) => {//メッセージの送信時
  if (message.author.id == client.user.id || message.author.bot) return;
  await handlers.get("messageCreate").default(message);
});

client.on("messageReactionAdd", async (reaction, user) => {//リアクションが追加されたとき
  if (user.id == client.user.id || user.bot) return;
  await handlers.get("messageReactionAdd").default(reaction, user);
});

client.on('warn', (info) => {// 警告メッセージのリスニング
  console.warn('Discord.js warning:', info);
});

client.on('error', async (error) => {// エラー発生時の処理
  try {
    const channel = await client.channels.fetch(process.env.logch_error);
    if (channel.isTextBased()) { // チャンネルがテキストチャンネルであることを確認
      const embed = new EmbedBuilder()
        .setTitle('エラーログ')
        .setDescription(`エラーが発生しました`)
        .setColor('#ff0000') // 赤色
        .setTimestamp()
        .addFields({name: "エラーメッセージ",value: "```\n" + error.message +"\n```"});

      await channel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error('エラーメッセージの送信に失敗しました:', err);
  }
});

client.on("ready", async () => {//Bot の起動時に必要な全ての初期設定や処理
  await handlers.get("ready").default(client);
});


Notification.sync({ alter: true });

CommandsRegister();
client.login(process.env.TOKEN);

