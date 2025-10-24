import { Message } from 'discord.js';
import { Rias } from '@lealt/rias';
import { Command } from '../types';

const command: Command = {
  name: 'resume',
  description: 'Resume the paused song',
  aliases: [],
  usage: '!resume',
  async execute(message: Message, _args: string[], rias: Rias): Promise<void> {
    const player = rias.get(message.guildId!);

    if (!player) {
      await message.reply('There is no music playing!');
      return;
    }

    if (!player.paused) {
      await message.reply('The music is not paused!');
      return;
    }

    await player.resume();
    await message.reply('Resumed the music!');
  }
};

export default command;
