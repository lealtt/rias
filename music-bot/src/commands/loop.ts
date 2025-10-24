import { Message } from 'discord.js';
import { Rias } from '@lealt/rias';
import { Command } from '../types';

const command: Command = {
  name: 'loop',
  description: 'Set loop mode (none, track, or queue)',
  aliases: ['repeat'],
  usage: '!loop <none|track|queue>',
  async execute(message: Message, args: string[], rias: Rias): Promise<void> {
    const player = rias.get(message.guildId!);

    if (!player) {
      await message.reply('There is no music playing!');
      return;
    }

    if (!args.length) {
      await message.reply(
        `Current loop mode: **${player.queue.loopMode}**\nUsage: \`!loop <none|track|queue>\``
      );
      return;
    }

    const mode = args[0].toLowerCase();

    if (mode !== 'none' && mode !== 'track' && mode !== 'queue') {
      await message.reply('Invalid loop mode! Use: `none`, `track`, or `queue`');
      return;
    }

    player.setLoop(mode as 'none' | 'track' | 'queue');

    let emoji = '';
    let description = '';

    switch (mode) {
      case 'none':
        emoji = '➡️';
        description = 'Loop disabled';
        break;
      case 'track':
        emoji = '🔂';
        description = 'Repeating current track';
        break;
      case 'queue':
        emoji = '🔁';
        description = 'Repeating queue';
        break;
    }

    await message.reply(`${emoji} ${description}`);
  }
};

export default command;
