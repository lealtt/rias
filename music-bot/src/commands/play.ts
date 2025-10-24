import { GuildMember, Message } from 'discord.js';
import { Rias } from '@lealt/rias';
import { Command } from '../types';
import { setupPlayerEvents } from '../utils/playerEvents';

const command: Command = {
  name: 'play',
  description: 'Play a song from YouTube, Spotify, or other sources',
  aliases: ['p'],
  usage: '!play <song name or URL>',
  async execute(message: Message, args: string[], rias: Rias): Promise<void> {
    const member = message.member as GuildMember;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      await message.reply('You need to be in a voice channel to play music!');
      return;
    }

    if (!args.length) {
      await message.reply('Please provide a song name or URL!');
      return;
    }

    const query = args.join(' ');

    try {
      // Get or create player
      let player = rias.get(message.guildId!);

      if (!player) {
        player = rias.create(message.guildId!);
        player.textChannel = message.channelId;
        player.connect(voiceChannel.id, { deaf: true });
        setupPlayerEvents(player, message.client);
      }

      // Search for tracks
      const result = await rias.search(query);

      if (result.loadType === 'empty' || result.loadType === 'error') {
        await message.reply('No results found!');
        return;
      }

      switch (result.loadType) {
        case 'playlist': {
          const tracks = result.data.tracks;

          // If nothing is playing, play the first track
          if (!player.playing && !player.paused) {
            await player.play({ track: tracks[0] });
            // Add the rest to the queue
            if (tracks.length > 1) {
              player.addTracks(tracks.slice(1));
            }
          } else {
            // Add all tracks to the queue
            player.addTracks(tracks);
          }

          await message.reply(
            `Added playlist **${result.data.info.name}** with ${tracks.length} tracks to the queue!`
          );
          break;
        }

        case 'track': {
          const track = result.data;

          if (!player.playing && !player.paused) {
            await player.play({ track });
            await message.reply(`Now playing **${track.info.title}**!`);
          } else {
            player.addTrack(track);
            await message.reply(
              `Added **${track.info.title}** to the queue (position ${player.queue.size})!`
            );
          }

          break;
        }

        case 'search': {
          const track = result.data[0];

          if (!player.playing && !player.paused) {
            await player.play({ track });
            await message.reply(`Now playing **${track.info.title}**!`);
          } else {
            player.addTrack(track);
            await message.reply(
              `Added **${track.info.title}** to the queue (position ${player.queue.size})!`
            );
          }

          break;
        }

        default:
          await message.reply('No valid tracks or playlists were found.');
          break;
      }
    } catch (error) {
      console.error(error);
      await message.reply('An error occurred while trying to play the song!');
    }
  }
};

export default command;
