import { Message, EmbedBuilder } from 'discord.js';
import { Rias } from '@lealt/rias';
import { Command } from '../types';

const command: Command = {
  name: 'queue',
  description: 'Show the current queue',
  aliases: ['q'],
  usage: '!queue',
  async execute(message: Message, _args: string[], rias: Rias): Promise<void> {
    const player = rias.get(message.guildId!);

    if (!player) {
      await message.reply('There is no music playing!');
      return;
    }

    if (!player.track && player.queue.isEmpty) {
      await message.reply('The queue is empty!');
      return;
    }

    const embed = new EmbedBuilder().setTitle('Music Queue').setColor('#0099ff').setTimestamp();

    // Current track
    if (player.track) {
      embed.addFields({
        name: 'Now Playing',
        value: `**${player.track.info.title}** by ${player.track.info.author}`
      });
    }

    // Queue
    if (player.queue.size > 0) {
      const tracks = player.queue.all;
      const queueList = tracks
        .slice(0, 10)
        .map((track, index) => `${index + 1}. **${track.info.title}** by ${track.info.author}`)
        .join('\n');

      embed.addFields({
        name: `Up Next (${player.queue.size} track${player.queue.size === 1 ? '' : 's'})`,
        value: queueList + (player.queue.size > 10 ? '\n...and more' : '')
      });
    }

    // Loop mode
    if (player.queue.loopMode !== 'none') {
      embed.setFooter({ text: `Loop: ${player.queue.loopMode}` });
    }

    await message.reply({ embeds: [embed] });
  }
};

export default command;
