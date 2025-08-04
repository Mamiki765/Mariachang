// main.mjs の最終版コード（この内容でファイルを上書き）
import fs from "fs";
import path from "path";
import express from "express";
import {
  Client,
  Collection,
  GatewayIntentBits,
  EmbedBuilder,
  Partials,
} from "discord.js";
import CommandsRegister from "./regist-commands.mjs";
import config from "./config.mjs";

const app = express();
let postCount = 0;

app.post("/", function (req, res) {
  console.log(`Received POST request.`);
  postCount++;
  if (postCount == 10) {
    postCount = 0;
  }
  res.send("POST response by koyeb");
});

app.get("/", function (req, res) {
  console.log(
    `[${new Date().toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      hour12: false,
    })}] Received ${req.method} request.`
  );
  const htmlContent = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>Bot Status Page</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;line-height:1.6;text-align:center;padding:40px;background-color:#f7f7f7;color:#333}.container{max-width:600px;margin:0 auto;background-color:#fff;padding:30px;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,0.1)}h1{color:#1a1a1a}p{margin-bottom:20px}a{color:#007bff;text-decoration:none}a:hover{text-decoration:underline}.footer{margin-top:30px;font-size:0.9em;color:#777}</style></head><body><div class="container"><h1>Discord Bot "Mariachang"</h1><p class="footer">このページは、ボットをホストしているサーバーの稼働確認用に表示されます。</p><hr><p><strong>このボットのソースコード:</strong><br><a href="https://github.com/Mamiki765/Mariachang" target="_blank" rel="noopener noreferrer">https://github.com/Mamiki765/Mariachang</a></p><p><strong>元になったBotの解説記事:</strong><br><a href="https://note.com/exteoi/n/n0ea64e258797" target="_blank" rel="noopener noreferrer">note.com/exteoi/n/n0ea64e258797</a></p></div></body></html>`;
  res.send(htmlContent);
});

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

async function startBot() {
  console.log("[Loader] Loading commands and handlers...");
  client.commands = new Collection();
  const handlers = new Map();

  const categoryFoldersPath = path.join(process.cwd(), "commands");
  const commandFolders = fs.readdirSync(categoryFoldersPath);
  const commandPromises = [];
  for (const folder of commandFolders) {
    const commandsPath = path.join(categoryFoldersPath, folder);
    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter((file) => file.endsWith(".mjs"));
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      commandPromises.push(
        import(filePath).then((module) => {
          client.commands.set(module.data.name, module);
        })
      );
    }
  }

  const handlersPath = path.join(process.cwd(), "handlers");
  const handlerFiles = fs
    .readdirSync(handlersPath)
    .filter((file) => file.endsWith(".mjs"));
  const handlerPromises = handlerFiles.map((file) => {
    const filePath = path.join(handlersPath, file);
    return import(filePath).then((module) => {
      handlers.set(file.slice(0, -4), module);
    });
  });

  await Promise.all([...commandPromises, ...handlerPromises]);
  console.log(
    "[Loader] All commands and handlers have been loaded successfully."
  );

  client.on("guildCreate", (guild) =>
    handlers.get("guildCreate").default(guild, client)
  );
  client.on("guildDelete", (guild) =>
    handlers.get("guildDelete").default(guild, client)
  );
  client.on("interactionCreate", (interaction) =>
    handlers.get("interactionCreate").default(interaction)
  );
  /*
client.on("voiceStateUpdate", async (oldState, newState) => {//ボイスチャンネルの状態変化
  await handlers.get("voiceStateUpdate").default(oldState, newState);
});
*/
  client.on("threadCreate", (thread) =>
    handlers.get("threadCreate").default(thread)
  );
  client.on("messageCreate", (message) => {
    if (message.author.id == client.user.id || message.author.bot) return;
    handlers.get("messageCreate").default(message);
  });
  client.on("messageReactionAdd", (reaction, user) => {
    if (user.id == client.user.id || user.bot) return;
    handlers.get("messageReactionAdd").default(reaction, user);
  });
  client.on("warn", (info) => console.warn("Discord.js warning:", info));
  client.on("error", async (error) => {
    console.error("An error occurred in the client:", error);
    try {
      const channel = await client.channels.fetch(config.logch.error);
      if (channel.isTextBased()) {
        const embed = new EmbedBuilder()
          .setTitle("エラーログ")
          .setDescription(`エラーが発生しました`)
          .setColor("#ff0000")
          .setTimestamp()
          .addFields({
            name: "エラーメッセージ",
            value: "```\n" + error.message + "\n```",
          });
        await channel.send({ embeds: [embed] });
      }
    } catch (err) {
      console.error("エラーメッセージの送信に失敗しました:", err);
    }
  });
  client.on("ready", () => handlers.get("ready").default(client));

  app.listen(3000, () => {
    console.log("Express server is listening on port 3000 for health checks.");
  });

  await CommandsRegister();
  await client.login(process.env.TOKEN);
}

startBot().catch((error) => {
  console.error("Botの起動中に致命的なエラーが発生しました:", error);
  process.exit(1);
});
