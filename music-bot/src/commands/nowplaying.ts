import { Message, EmbedBuilder } from 'discord.js';
import { Rias, getThumbnail, formatTime, createProgressBar } from '@lealt/rias';
import { Command } from '../types';

const command: Command = {
  name: 'nowplaying',
  description: 'Show the currently playing song',
  aliases: ['np', 'current'],
  usage: '!nowplaying',
  async execute(message: Message, _args: string[], rias: Rias): Promise<void> {
    const player = rias.get(message.guildId!);

    if (!player || !player.track) {
      await message.reply('There is no music playing!');
      return;
    }

    const track = player.track;
    const position = player.position;
    const duration = track.info.length;

    const embed = new EmbedBuilder()
      .setTitle('Now Playing')
      .setDescription(`**${track.info.title}**`)
      .addFields(
        { name: 'Author', value: track.info.author, inline: true },
        { name: 'Duration', value: formatTime(duration), inline: true },
        {
          name: 'Progress',
          value: `${createProgressBar(position, duration)}\n${formatTime(position)} / ${formatTime(duration)}`
        }
      )
      .setColor('#0099ff')
      .setTimestamp();

    if (track.info.artworkUrl) {
      embed.setThumbnail(getThumbnail(track));
    }

    await message.reply({ embeds: [embed] });
  }
};

export default command;
