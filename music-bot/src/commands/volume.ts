import { Message } from 'discord.js';
import { Rias } from '@lealt/rias';
import { Command } from '../types';

const command: Command = {
  name: 'volume',
  description: 'Set or view the current volume (0-100)',
  aliases: ['vol', 'v'],
  usage: '!volume [0-100]',
  async execute(message: Message, args: string[], rias: Rias): Promise<void> {
    const player = rias.get(message.guildId!);

    if (!player) {
      await message.reply('There is no music playing!');
      return;
    }

    if (!args.length) {
      await message.reply(`Current volume: **${player.volume}%**`);
      return;
    }

    const volume = parseInt(args[0]);

    if (isNaN(volume) || volume < 0 || volume > 100) {
      await message.reply('Please provide a valid volume between 0 and 100!');
      return;
    }

    await player.setVolume(volume);
    await message.reply(`Volume set to **${volume}%**!`);
  }
};

export default command;
