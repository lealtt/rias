import { Client, Events } from 'discord.js';
import { Rias } from '@lealt/rias';
import { logger } from '../utils/logger';

export default function (client: Client, _rias: Rias): void {
  client.once(Events.ClientReady, readyClient => {
    logger.success(`Bot is ready! Logged in as ${readyClient.user.displayName}`);
    logger.info(`Serving ${readyClient.guilds.cache.size} guilds`);
  });
}
