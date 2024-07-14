import fs from "fs";
import path from "path";
import express from "express";
import { Client, Collection, Events, GatewayIntentBits, ActivityType, EmbedBuilder } from "discord.js";
import CommandsRegister from "./regist-commands.mjs";
import Notification from "./models/notification.mjs";

import Sequelize from "sequelize";
import Parser from 'rss-parser';
import cron from 'node-cron';
const parser = new Parser();

//テスト、時間カウントできてるか
//cron.schedule('0 * * * * *', () => console.log('毎分実行'));
//ここまで

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
  await cron.schedule('0 * * * *', () => {
     timechannel.send(`${new Date().getHours()} 時になりました。`)
   })
//時報テストここまで
  await client.user.setActivity('🍙', { type: ActivityType.Custom, state: "今日も雨宿り中" });
  console.log(`${client.user.tag} がログインしました！`);
});


Notification.sync({ alter: true });

CommandsRegister();
client.login(process.env.TOKEN);

