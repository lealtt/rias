import { Message } from 'discord.js';
import { Rias } from '@lealt/rias';
import { Command } from '../types';

const command: Command = {
  name: 'stop',
  description: 'Stop the music and clear the queue',
  aliases: ['leave', 'disconnect'],
  usage: '!stop',
  async execute(message: Message, _args: string[], rias: Rias): Promise<void> {
    const player = rias.get(message.guildId!);

    if (!player) {
      await message.reply('There is no music playing!');
      return;
    }

    await player.destroy();
    await message.reply('Stopped the music!');
  }
};

export default command;
