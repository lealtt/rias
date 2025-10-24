import { Message } from 'discord.js';
import { Rias } from '@lealt/rias';
import { Command } from '../types';

const command: Command = {
  name: 'skip',
  description: 'Skip the current song',
  aliases: ['s', 'next'],
  usage: '!skip',
  async execute(message: Message, _args: string[], rias: Rias): Promise<void> {
    const player = rias.get(message.guildId!);

    if (!player) {
      await message.reply('There is no music playing!');
      return;
    }

    if (!player.track) {
      await message.reply('There is no song currently playing!');
      return;
    }

    const skipped = player.track;
    const hasNext = await player.skip();

    if (hasNext) {
      await message.reply(`Skipped **${skipped.info.title}**!`);
    } else {
      await message.reply(`Skipped **${skipped.info.title}**! Queue is now empty.`);
    }
  }
};

export default command;
