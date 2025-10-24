import { Message, EmbedBuilder } from 'discord.js';
import { Rias } from '@lealt/rias';
import { Command } from '../types';
import { commands } from '../handlers/commandHandler';

const command: Command = {
  name: 'help',
  description: 'Show all available commands',
  aliases: ['h', 'commands'],
  usage: '!help [command]',
  async execute(message: Message, args: string[], _rias: Rias): Promise<void> {
    if (args.length > 0) {
      const commandName = args[0].toLowerCase();
      const cmd = commands.get(commandName);

      if (!cmd) {
        await message.reply('That command does not exist!');
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`Command: ${cmd.name}`)
        .setDescription(cmd.description)
        .setColor('#0099ff');

      if (cmd.aliases && cmd.aliases.length > 0) {
        embed.addFields({ name: 'Aliases', value: cmd.aliases.join(', ') });
      }

      if (cmd.usage) {
        embed.addFields({ name: 'Usage', value: `\`${cmd.usage}\`` });
      }

      await message.reply({ embeds: [embed] });
      return;
    }

    const commandList = new Map<string, Command>();
    commands.forEach((cmd, name) => {
      if (cmd.name === name) {
        commandList.set(name, cmd);
      }
    });

    const embed = new EmbedBuilder()
      .setTitle('Music Bot Commands')
      .setDescription('Use `!help <command>` for more information about a specific command')
      .setColor('#0099ff')
      .setTimestamp();

    const commandsArray = Array.from(commandList.values());
    const commandsText = commandsArray
      .map(cmd => `**${cmd.name}** - ${cmd.description}`)
      .join('\n');

    embed.addFields({ name: 'Available Commands', value: commandsText });

    await message.reply({ embeds: [embed] });
  }
};

export default command;
