import { Message } from 'discord.js';
import { Rias } from '@lealt/rias';
import { Command } from '../types';

const command: Command = {
  name: 'shuffle',
  description: 'Shuffle the queue',
  aliases: [],
  usage: '!shuffle',
  async execute(message: Message, _args: string[], rias: Rias): Promise<void> {
    const player = rias.get(message.guildId!);

    if (!player) {
      await message.reply('There is no music playing!');
      return;
    }

    if (player.queue.size < 2) {
      await message.reply('There are not enough songs in the queue to shuffle!');
      return;
    }

    player.shuffleQueue();
    await message.reply(`Shuffled **${player.queue.size}** songs in the queue!`);
  }
};

export default command;
