import { Message } from 'discord.js';
import { Rias } from '@lealt/rias';

export interface Command {
  name: string;
  description: string;
  aliases?: string[];
  usage?: string;
  execute: (message: Message, args: string[], rias: Rias) => Promise<void>;
}

export interface BotConfig {
  token: string;
  clientId: string;
  prefix: string;
  lavalink: {
    host: string;
    port: number;
    password: string;
  };
}
