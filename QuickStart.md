# 🎵 Music Bot Architecture Guide

This document explains the architecture and structure of the reference music bot implementation included with `@lealt/rias`.

## 📁 Project Structure

```
music-bot/
├── src/
│   ├── commands/         # Command implementations
│   │   ├── help.ts
│   │   ├── info.ts
│   │   ├── loop.ts
│   │   ├── nowplaying.ts
│   │   ├── pause.ts
│   │   ├── play.ts
│   │   ├── queue.ts
│   │   ├── resume.ts
│   │   ├── shuffle.ts
│   │   ├── skip.ts
│   │   ├── stop.ts
│   │   └── volume.ts
│   ├── events/          # Event handlers
│   │   └── ready.ts
│   ├── handlers/        # Core handlers
│   │   ├── commandHandler.ts
│   │   └── eventHandler.ts
│   ├── utils/           # Utilities
│   │   ├── logger.ts
│   │   └── playerEvents.ts
│   ├── types/           # TypeScript types
│   │   └── index.ts
│   └── index.ts         # Entry point
├── package.json
└── tsconfig.json
```

## 🚀 Entry Point (src/index.ts)

The main file initializes:

1. **Discord Client** with required intents
2. **Rias Instance** after client login
3. **Command System** via dynamic loading
4. **Event Handlers** for Discord and Rias events
5. **Error Handlers** for node connection issues

Key responsibilities:

- Loads all commands from `commands/` directory
- Sets up Rias with proper configuration (client-first initialization)
- Registers global error handlers for graceful node failures
- Implements graceful shutdown

## 🎯 Command Handler (src/handlers/commandHandler.ts)

Dynamic command loading system:

- **Scans** `commands/` directory for `.ts`/`.js` files
- **Loads** commands into a Collection
- **Filters** `.d.ts` files to avoid import errors
- **Handles** message-based commands with prefix

All commands follow a consistent interface:

```typescript
{
  name: string;
  description: string;
  aliases?: string[];
  usage: string;
  execute(message, args, rias): Promise<void>;
}
```

## 🎵 Core Commands

### Play Command (src/commands/play.ts)

- **Creates or retrieves** player for the guild
- **Sets up event listeners** on new players (via `setupPlayerEvents`)
- **Searches** for tracks using `rias.search()`
- **Handles** different result types (track, playlist, search)
- **Uses Queue system**: plays immediately if idle, adds to queue if playing

### Queue Management

- **queue.ts**: Displays current track and upcoming tracks (up to 10)
- **skip.ts**: Skips to next track using `player.skip()`
- **shuffle.ts**: Shuffles queue using `player.shuffleQueue()`
- **loop.ts**: Controls loop modes (none/track/queue)

### Playback Control

- **pause.ts / resume.ts**: Pause and resume playback
- **stop.ts**: Destroys player and disconnects
- **volume.ts**: Adjusts player volume (0-100)

### Information

- **nowplaying.ts**: Shows current track with progress bar (uses `formatTime` and `createProgressBar` from library)
- **info.ts**: Displays Lavalink server info, stats, and plugins (uses `formatBytes`, `formatTime`, `percentage` utilities)
- **help.ts**: Lists available commands

## 🎧 Player Event System (src/utils/playerEvents.ts)

Centralized event handler setup for players:

- **trackStart**: Logs and announces track in text channel
- **trackEnd**: Automatically handled by library's Queue system with loop support
- **queueEnd**: Notifies when queue is empty
- **trackException**: Logs and notifies about playback errors
- **trackStuck**: Logs stuck tracks
- **error**: Handles player errors

Called once when creating new players to avoid duplicate listeners.

## 📦 Key Features

### 1. High-Level Queue System

Uses `@lealt/rias` built-in `Queue` class:

- **Auto-play**: Automatically plays next track when current ends
- **Loop modes**: Track, Queue, or None
- **Smart shuffle**: Avoids consecutive tracks from same artist
- **Advanced operations**: insert, move, swap, filter

### 2. Library Utilities

Commands use utilities from `@lealt/rias`:

- `formatTime()`: Formats milliseconds to MM:SS
- `createProgressBar()`: Creates visual progress bars
- `getThumbnail()`: Gets track artwork
- `formatBytes()`: Formats byte sizes
- `percentage()`: Calculates percentages

### 3. Proper Initialization Order

1. Create Discord client
2. Load commands
3. Login to Discord
4. Initialize Rias (after client ready)
5. Setup command and event handlers

### 4. Error Handling

- Node connection errors handled gracefully
- Bot continues running even if Lavalink is unavailable
- Error events logged with proper context

## 🔧 Configuration

### Environment Variables (.env)

```env
DISCORD_TOKEN=your_bot_token
LAVALINK_HOST=localhost
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass
BOT_PREFIX=!
```

### Node Configuration

```typescript
{
  id: 'main',              // Unique identifier
  host: 'localhost',       // Lavalink host
  port: 2333,              // Lavalink port
  password: 'password',    // Lavalink password
  secure: false            // Use WSS/HTTPS
}
```

### Required Discord Intents

- `Guilds` - Access to guild information
- `GuildVoiceStates` - Voice state tracking
- `GuildMessages` - Message reading
- `MessageContent` - Message content access

## 🎨 Extending the Bot

### Adding New Commands

1. Create file in `src/commands/`
2. Export default object with command interface
3. File is automatically loaded on startup

### Adding Event Handlers

1. Create file in `src/events/`
2. Export default function that registers listeners
3. File is automatically loaded on startup

### Customizing Player Events

Modify `src/utils/playerEvents.ts` to add:

- Custom announcements
- Database logging
- Advanced queue logic
- Voting systems

## 📚 Important Concepts

### Player Lifecycle

1. **Created** via `rias.create(guildId)`
2. **Connected** via `player.connect(channelId)`
3. **Playing** via `player.play({ track })`
4. **Destroyed** via `player.destroy()` or on idle timeout

### Queue vs Player

- **Player**: Manages current track playback
- **Queue**: Manages upcoming tracks (built into Player)
- Queue operations: `addTrack()`, `skip()`, `shuffleQueue()`, `setLoop()`

### Event Flow

```
User Command → Command Handler → Player Action → Player Events → Announcements
```

## 🔗 Related Documentation

- [Main README](./README.md) - Library documentation
- [Lavalink v4 Docs](https://lavalink.dev/) - Lavalink server setup
- [Discord.js Guide](https://discordjs.guide/) - Discord bot development

---

This architecture provides a solid foundation for building feature-rich Discord music bots with `@lealt/rias`.
