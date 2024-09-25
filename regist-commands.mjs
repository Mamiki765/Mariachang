import fs from 'fs';
import path from 'path';
import { REST, Routes } from 'discord.js';

const commands = [];
const foldersPath = path.join(process.cwd(), 'commands');
const commandFolders = fs.readdirSync(foldersPath);

export default async () => {
  for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.mjs'));
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      await import(filePath).then(module => {
        commands.push(module.data.toJSON());
      });
    }
  }

  const rest = new REST().setToken(process.env.TOKEN);

  (async () => {
    try {
      console.log(`[INIT] ${commands.length}つのスラッシュコマンドを更新します。`);

      const data = await rest.put(
        Routes.applicationCommands(process.env.APPLICATION_ID),
        { body: commands },
      );

      const dataGuild = await rest.put(
        Routes.applicationCommands(process.env.APPLICATION_ID),
        { body: commands },
      );

      console.log(`[INIT] ${commands.length}つのスラッシュコマンドを更新しました。`);
    } catch (error) {
      console.error(error);
    }
  })();
};
