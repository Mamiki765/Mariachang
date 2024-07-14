import { ContextMenuCommandBuilder,  ApplicationCommandType, EmbedBuilder} from "discord.js";

export const data = new ContextMenuCommandBuilder()
  .setName("何も起きない")
  .setType(ApplicationCommandType.Message);