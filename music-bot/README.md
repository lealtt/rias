# Rias Music Bot

A feature-rich Discord music bot built with the **Rias** library and **Discord.js**. This bot provides high-quality music playback using Lavalink.

## Features

- ✅ High-quality music playback via Lavalink v4
- ✅ Auto-play with queue management (built into Player)
- ✅ Loop modes: track, queue, none
- ✅ Smart shuffle algorithm (avoids consecutive same artists)
- ✅ Volume control (0-100)
- ✅ Progress bars using library utilities
- ✅ Lavalink server and plugin information
- ✅ Event-driven architecture
- ✅ Comprehensive error handling
- ✅ TypeScript with full type safety

## Prerequisites

- Node.js 18.x or higher
- Docker and Docker Compose (for Lavalink)
- A Discord bot token
- Discord application with Message Content intent enabled

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_client_id_here
PREFIX=!
LAVALINK_HOST=localhost
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass
```

### 3. Start Lavalink

Start the Lavalink server using Docker Compose:

```bash
docker-compose up -d
```

Wait a few seconds for Lavalink to fully initialize.

### 4. Run the Bot

Development mode (with hot reload):

```bash
npm run dev
```

Production mode:

```bash
npm run build
npm start
```

## Project Structure

```
music-bot/
├── src/
│   ├── commands/          # Bot commands
│   │   ├── play.ts
│   │   ├── pause.ts
│   │   ├── skip.ts
│   │   ├── queue.ts
│   │   └── ...
│   ├── events/            # Event handlers
│   │   ├── ready.ts
│   │   ├── trackStart.ts
│   │   └── ...
│   ├── handlers/          # System handlers
│   │   ├── commandHandler.ts
│   │   └── eventHandler.ts
│   ├── utils/             # Utility functions
│   │   └── logger.ts
│   ├── types/             # TypeScript types
│   │   └── index.ts
│   └── index.ts           # Entry point
├── docker-compose.yml     # Lavalink container config
├── application.yml        # Lavalink configuration
├── .env.example          # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

## Available Commands

| Command           | Aliases                   | Description                          |
| ----------------- | ------------------------- | ------------------------------------ |
| `!play <query>`   | `!p`                      | Play a song from URL or search query |
| `!pause`          | -                         | Pause the current song               |
| `!resume`         | -                         | Resume the paused song               |
| `!skip`           | `!s`, `!next`             | Skip the current song                |
| `!stop`           | -                         | Stop music and disconnect            |
| `!queue`          | `!q`                      | Display the current queue            |
| `!shuffle`        | -                         | Shuffle the queue                    |
| `!loop <mode>`    | `!repeat`                 | Set loop mode (none/track/queue)     |
| `!nowplaying`     | `!np`, `!current`         | Show currently playing song          |
| `!volume [0-100]` | -                         | Set or view volume                   |
| `!info`           | `!serverinfo`, `!plugins` | Show Lavalink server and plugin info |
| `!help`           | -                         | Show help information                |

## Usage Examples

### Play a song

```
!play never gonna give you up
!play https://www.youtube.com/watch?v=dQw4w9WgXcQ
!p spotify:track:6rqhFgbbKwnb9MLmUQDhG6
```

### Manage playback

```
!pause
!resume
!skip
!stop
```

### View queue

```
!queue
!nowplaying
```

### Adjust volume

```
!volume 50
!vol
```

## Adding New Commands

1. Create a new file in `src/commands/` (e.g., `mycommand.ts`)
2. Use this template:

```typescript
import { Message } from 'discord.js';
import { Rias } from 'rias';
import { Command } from '../types';

const command: Command = {
  name: 'mycommand',
  description: 'Description of what this command does',
  aliases: ['alias1', 'alias2'],
  usage: '!mycommand <args>',
  async execute(message: Message, args: string[], rias: Rias): Promise<void> {
    // Your command logic here
    await message.reply('Command executed!');
  }
};

export default command;
```

3. The command will be automatically loaded on bot restart

## Adding New Events

1. Create a new file in `src/events/` (e.g., `myevent.ts`)
2. Use this template:

```typescript
import { Client } from 'discord.js';
import { Rias } from 'rias';
import { logger } from '../utils/logger';

export default function (client: Client, rias: Rias): void {
  rias.on('eventName', (...args) => {
    logger.info('Event triggered!');
    // Your event logic here
  });
}
```

3. The event will be automatically loaded on bot restart

## Lavalink Configuration

The Lavalink server is configured via `application.yml`. You can modify:

- Source providers (YouTube, Spotify, SoundCloud, etc.)
- Audio filters
- Buffer settings
- Search limits

After modifying the configuration, restart the Lavalink container:

```bash
docker-compose restart
```

## Troubleshooting

### Bot doesn't respond to commands

- Ensure the Message Content intent is enabled in Discord Developer Portal
- Check that the prefix in `.env` matches what you're typing
- Verify the bot has permission to read messages in the channel

### Music doesn't play

- Check that Lavalink is running: `docker-compose ps`
- View Lavalink logs: `docker-compose logs lavalink`
- Ensure the bot has permission to join and speak in voice channels

### Lavalink connection failed

- Verify Lavalink credentials in `.env` match `application.yml`
- Check that port 2333 is not being used by another service
- Ensure Docker is running

## Scripts

| Command          | Description                             |
| ---------------- | --------------------------------------- |
| `npm run dev`    | Run in development mode with hot reload |
| `npm run build`  | Compile TypeScript to JavaScript        |
| `npm start`      | Run compiled code in production         |
| `npm run lint`   | Check code for linting errors           |
| `npm run format` | Format code with Prettier               |

## Technologies Used

- **Rias** - Lavalink wrapper for Discord.js
- **Discord.js** - Discord API library
- **TypeScript** - Type-safe JavaScript
- **Lavalink** - Audio delivery system
- **Docker** - Containerization for Lavalink

## License

MIT

## Documentation

- 📖 [Architecture Guide](../QuickStart.md) - Detailed explanation of the bot structure
- 📚 [Rias Library Documentation](../README.md) - Main library API reference
- 🎵 [Lavalink Documentation](https://lavalink.dev/) - Lavalink server documentation

## Support

For issues and questions about:

- **Rias library**: Check the main repository
- **This bot**: Open an issue in this repository
- **Lavalink**: Visit [Lavalink documentation](https://lavalink.dev/)
