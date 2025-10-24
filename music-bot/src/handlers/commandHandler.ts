import { Client, Collection, Events, Message } from 'discord.js';
import { Rias } from '@lealt/rias';
import { readdirSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';
import { Command } from '../types';

export const commands = new Collection<string, Command>();

export async function loadCommands(): Promise<void> {
  const commandsPath = join(__dirname, '../commands');
  const commandFiles = readdirSync(commandsPath).filter(
    file => (file.endsWith('.ts') || file.endsWith('.js')) && !file.endsWith('.d.ts')
  );

  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    const command: Command = (await import(filePath)).default;

    if (command && command.name) {
      commands.set(command.name, command);
      logger.success(`Loaded command: ${command.name}`);

      if (command.aliases) {
        command.aliases.forEach(alias => {
          commands.set(alias, command);
        });
      }
    }
  }
}

export function setupCommandHandler(client: Client, rias: Rias, prefix: string): void {
  client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot || !message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;

    const command = commands.get(commandName);

    if (!command) return;

    try {
      logger.info(`${message.author.tag} executed command: ${command.name}`);
      await command.execute(message, args, rias);
    } catch (error) {
      logger.error(`Error executing command ${command.name}:`, error as Error);
      await message.reply('There was an error executing that command!');
    }
  });
}
