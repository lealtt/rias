import { Client } from 'discord.js';
import { Player } from '@lealt/rias';
import { logger } from './logger';

/**
 * Set up event listeners for a player
 */
export function setupPlayerEvents(player: Player, client: Client): void {
  // Track started
  player.on('trackStart', track => {
    logger.info(`Now playing: ${track.info.title} in guild ${player.guildId}`);

    if (player.textChannel) {
      const channel = client.channels.cache.get(player.textChannel);
      if (channel && channel.isTextBased() && 'send' in channel) {
        channel.send(`Now playing: **${track.info.title}** by ${track.info.author}`);
      }
    }
  });

  // Track ended
  player.on('trackEnd', (track, reason) => {
    logger.debug(`Track ended: ${track.info.title} in guild ${player.guildId} (reason: ${reason})`);
  });

  // Queue ended
  player.on('queueEnd', () => {
    logger.info(`Queue ended in guild ${player.guildId}`);

    if (player.textChannel) {
      const channel = client.channels.cache.get(player.textChannel);
      if (channel && channel.isTextBased() && 'send' in channel) {
        channel.send('Queue has ended. Add more songs or use `!stop` to disconnect.');
      }
    }
  });

  // Track exception
  player.on('trackException', (track, exception) => {
    logger.error(`Track exception for ${track.info.title}: ${exception.message}`);

    if (player.textChannel) {
      const channel = client.channels.cache.get(player.textChannel);
      if (channel && channel.isTextBased() && 'send' in channel) {
        channel.send(`Failed to play **${track.info.title}**: ${exception.message}`);
      }
    }
  });

  // Track stuck
  player.on('trackStuck', (track, thresholdMs) => {
    logger.warn(`Track stuck: ${track.info.title} (${thresholdMs}ms)`);
  });

  // Player error
  player.on('error', error => {
    logger.error(`Player error in guild ${player.guildId}:`, error);
  });
}
