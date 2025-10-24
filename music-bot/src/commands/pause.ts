import { Message } from 'discord.js';
import { Rias } from '@lealt/rias';
import { Command } from '../types';

const command: Command = {
  name: 'pause',
  description: 'Pause the current song',
  aliases: [],
  usage: '!pause',
  async execute(message: Message, _args: string[], rias: Rias): Promise<void> {
    const player = rias.get(message.guildId!);

    if (!player) {
      await message.reply('There is no music playing!');
      return;
    }

    if (player.paused) {
      await message.reply('The music is already paused!');
      return;
    }

    await player.pause(true);
    await message.reply('Paused the music!');
  }
};

export default command;
