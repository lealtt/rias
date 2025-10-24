import { Client } from 'discord.js';
import { Rias } from '@lealt/rias';
import { readdirSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';

export async function loadEvents(client: Client, rias: Rias): Promise<void> {
  const eventsPath = join(__dirname, '../events');
  const eventFiles = readdirSync(eventsPath).filter(
    file => (file.endsWith('.ts') || file.endsWith('.js')) && !file.endsWith('.d.ts')
  );

  for (const file of eventFiles) {
    const filePath = join(eventsPath, file);
    const event = await import(filePath);

    if (event.default && typeof event.default === 'function') {
      event.default(client, rias);
      logger.success(`Loaded event: ${file.replace(/\.(ts|js)$/, '')}`);
    }
  }
}
