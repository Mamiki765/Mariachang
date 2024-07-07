const { ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');

const data = new ContextMenuCommandBuilder()
	.setName('ピン留め（未実装）')
	.setType(ApplicationCommandType.Message);