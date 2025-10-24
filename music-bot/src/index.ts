import { Client, GatewayIntentBits } from 'discord.js';
import { Rias } from '@lealt/rias';
import { logger } from './utils/logger';
import { loadCommands, setupCommandHandler } from './handlers/commandHandler';
import { loadEvents } from './handlers/eventHandler';
import { BotConfig } from './types';

const botConfig: BotConfig = {
  token: process.env.DISCORD_TOKEN!,
  clientId: process.env.CLIENT_ID!,
  prefix: process.env.PREFIX || '!',
  lavalink: {
    host: process.env.LAVALINK_HOST || 'localhost',
    port: parseInt(process.env.LAVALINK_PORT || '2333'),
    password: process.env.LAVALINK_PASSWORD || 'youshallnotpass'
  }
};

async function main(): Promise<void> {
  if (!botConfig.token) {
    logger.error('DISCORD_TOKEN is not defined in environment variables!');
    process.exit(1);
  }

  logger.info('Starting bot...');

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  await loadCommands();
  logger.success('Commands loaded successfully!');

  await client.login(botConfig.token);

  // Initialize Rias after client is ready
  const rias = new Rias(client, {
    nodes: [
      {
        id: 'main',
        host: botConfig.lavalink.host,
        port: botConfig.lavalink.port,
        password: botConfig.lavalink.password,
        secure: false
      }
    ],
    send: (guildId: string, payload: Record<string, unknown>) => {
      const guild = client.guilds.cache.get(guildId);
      if (guild) {
        guild.shard.send(payload);
      }
    }
  });

  // Handle Rias errors
  rias.on('error', (nodeId, error) => {
    logger.error(`Node ${nodeId} error:`, error);
  });

  rias.on('disconnect', (nodeId, reason) => {
    logger.warn(`Node ${nodeId} disconnected: ${reason}`);
  });

  rias.on('connect', nodeId => {
    logger.success(`Node ${nodeId} connected!`);
  });

  rias.init();
  logger.success('Rias initialized and attempting to connect to Lavalink...');

  setupCommandHandler(client, rias, botConfig.prefix);
  logger.success('Command handler initialized!');

  await loadEvents(client, rias);
  logger.success('Events loaded successfully!');
}

main().catch(error => {
  logger.error('Failed to start bot:', error);
  process.exit(1);
});
