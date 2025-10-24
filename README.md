<div align="center">
  <h1>Rias</h1>
  <p>A modern, developer-friendly Lavalink v4 client for Discord.js with excellent TypeScript support</p>
  <img src="https://i.imgur.com/zwZZY6t.png" alt="Rias" width="200" />
</div>

## ✨ Features

- 🎵 **Lavalink v4 Support** - Full compatibility with the latest Lavalink REST API and WebSocket protocol
- 🔌 **Complete Plugin Support** - Full integration with Lavalink v4 plugin system including discovery, management, and custom filters
- 🎯 **TypeScript First** - Built with TypeScript for excellent IDE support and type safety
- 🚀 **Modern Architecture** - Clean, intuitive API design focused on developer experience
- 🎛️ **Advanced Features** - Queue management, filters, equalizer presets, and more
- 📦 **Dual Module Support** - Works with both CommonJS and ES Modules
- 🔌 **Discord.js Integration** - Seamless integration with Discord.js v14+
- 🛡️ **Robust Error Handling** - Comprehensive error handling with helpful messages
- 🔄 **Auto-Reconnection** - Automatic reconnection with exponential backoff
- 🎚️ **Filter Builder** - Easy-to-use API for creating complex audio filters
- 🎯 **Smart Queue** - Advanced queue management with shuffle, loop modes, and filtering
- 🌍 **Smart Node Selection** - 5 different strategies for optimal node selection including regional routing
- 🏷️ **Configurable User Agent** - Customize the user agent sent to Lavalink nodes

## 📦 Installation

```bash
npm install @lealt/rias
# or
yarn add @lealt/rias
# or
pnpm add @lealt/rias
```

## 🚀 Prerequisites

- Node.js 18.0.0 or higher
- Discord.js v14+
- A running Lavalink v4 server ([Setup Guide](https://lavalink.dev/getting-started/index.html))

## 📖 Quick Links

- [Music Bot Example](./music-bot/) - Full-featured reference implementation
- [Architecture Guide](./QuickStart.md) - Understanding the music-bot structure
- [API Reference](#-api-reference) - Complete API documentation

## Quick Start

```typescript
import { Client, GatewayIntentBits } from "discord.js";
import { Rias, NodeSelectionStrategy } from "@lealt/rias";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("ready", () => {
  const rias = new Rias(client, {
    nodes: [
      {
        id: "main",
        host: "localhost",
        port: 2333,
        password: "youshallnotpass",
      },
    ],
    send: (guildId, payload) => {
      const guild = client.guilds.cache.get(guildId);
      if (guild) guild.shard.send(payload);
    },
    // Optional: Customize user agent (defaults to "Rias")
    userAgent: "MyMusicBot/1.0.0",
    // Optional: Set node selection strategy (defaults to "load-balanced")
    nodeSelectionStrategy: NodeSelectionStrategy.LoadBalanced,
    // Optional: Enable debug mode for development
    debug: process.env.NODE_ENV === "development",
  });

  rias.init();

  // Handle graceful shutdown
  process.on("SIGTERM", async () => {
    await rias.shutdown();
    process.exit(0);
  });
});

client.login("YOUR_BOT_TOKEN");
```

## 💡 Usage Examples

### Playing a Track

```typescript
// Create or get a player
const player = rias.create(message.guildId);

// Or create with region preference (when using Regional strategy)
const player = rias.create(message.guildId, "us-west");

// Connect to voice channel
player.connect(voiceChannel.id, { deaf: true });

// Search for tracks
const result = await rias.search("never gonna give you up");

// Handle different result types
if (result.loadType === "search" && result.data.length > 0) {
  await player.play({ track: result.data[0] });
} else if (result.loadType === "track") {
  await player.play({ track: result.data });
}
```

### Advanced Queue Management

```typescript
import { Queue, LoopMode } from "@lealt/rias";

const queue = new Queue();

// Add tracks
queue.add(track);
queue.addMany(tracks);

// Set loop mode
queue.setLoopMode(LoopMode.Queue); // Loop entire queue
queue.setLoopMode(LoopMode.Track); // Loop current track
queue.setLoopMode(LoopMode.None); // No looping

// Smart shuffle (avoids consecutive tracks from same artist)
queue.smartShuffle();

// Filter operations
const byArtist = queue.filterByAuthor("Artist Name");
const byDuration = queue.filterByDuration(60000, 300000); // 1-5 minutes
queue.removeByAuthor("Unwanted Artist");
queue.removeDuplicates();

// Advanced operations
queue.insert(2, track); // Insert at position
queue.move(0, 5); // Move track
queue.swap(1, 3); // Swap tracks
queue.skipTo(5); // Skip to position
queue.reverse(); // Reverse order

// Get queue info
const summary = queue.getSummary();
console.log(`Queue: ${summary.size} tracks, ${formatTime(summary.duration)}`);
```

### Using Filter Builder

```typescript
import { FilterBuilder } from "@lealt/rias";

// Create filters using the builder
const filters = new FilterBuilder()
  .bassBoost("high")
  .nightcore()
  .eightD()
  .build();

await player.setFilters(filters);

// Or use presets
await player.setFilters({
  equalizer: EqualizerPresets.bass,
  timescale: { speed: 1.2, pitch: 1.2, rate: 1.0 },
});
```

### Error Handling

```typescript
import { RiasErrorCode } from "@lealt/rias";

try {
  await player.play({ track: someTrack });
} catch (error) {
  if (error.code === RiasErrorCode.NODE_NOT_CONNECTED) {
    console.error("Node is not connected. Please check your Lavalink server.");
  } else if (error.code === RiasErrorCode.NO_AVAILABLE_NODES) {
    console.error(
      "No nodes available. Please ensure at least one node is online."
    );
  } else {
    console.error("An error occurred:", error.message);
  }
}
```

### Player Events

```typescript
player.on("trackStart", (track) => {
  console.log(`Now playing: ${track.info.title}`);
});

player.on("trackEnd", async (track, reason) => {
  if (reason === TrackEndReason.Finished) {
    const nextTrack = queue.poll();
    if (nextTrack) {
      await player.play({ track: nextTrack });
    }
  }
});

player.on("trackException", (track, exception) => {
  console.error(`Track error: ${exception.message}`);
});

player.on("error", (error) => {
  console.error("Player error:", error);
});
```

### Node Events

```typescript
rias.on("connect", (nodeId) => {
  console.log(`Node ${nodeId} connected`);
});

rias.on("disconnect", (nodeId, reason, code) => {
  console.log(`Node ${nodeId} disconnected: ${reason} (code: ${code})`);
});

rias.on("reconnect", (nodeId, attempt, delay) => {
  console.log(
    `Node ${nodeId} reconnecting (attempt ${attempt}, delay ${delay}ms)`
  );
});

rias.on("error", (nodeId, error) => {
  console.error(`Node ${nodeId} error:`, error);
});

rias.on("ready", (nodeId, sessionId) => {
  console.log(`Node ${nodeId} ready (session: ${sessionId})`);
});

rias.on("pluginLoaded", (nodeId, plugin) => {
  console.log(`Plugin loaded on ${nodeId}: ${plugin.name}@${plugin.version}`);
});

rias.on("infoUpdate", (nodeId, info) => {
  console.log(
    `Server info updated for ${nodeId}: Lavalink ${info.version.semver}`
  );
});
```

### Multi-Node Configuration with Smart Selection

```typescript
import { Rias, NodeSelectionStrategy } from "@lealt/rias";

const rias = new Rias(client, {
  nodes: [
    {
      id: "us-west",
      host: "lavalink-us-west.example.com",
      port: 2333,
      password: "password",
      region: "us-west",
      priority: 1, // Higher priority (lower number)
    },
    {
      id: "us-east",
      host: "lavalink-us-east.example.com",
      port: 2333,
      password: "password",
      region: "us-east",
      priority: 1,
    },
    {
      id: "eu-central",
      host: "lavalink-eu.example.com",
      port: 2333,
      password: "password",
      region: "eu-central",
      priority: 2, // Lower priority
    },
  ],
  // Choose from 5 different strategies
  nodeSelectionStrategy: NodeSelectionStrategy.Regional,
  userAgent: "MyMusicBot/1.0.0",
  send: (guildId, payload) => {
    const guild = client.guilds.cache.get(guildId);
    if (guild) guild.shard.send(payload);
  },
});

// Create player with region hint (for Regional strategy)
const player = rias.create(guildId, "us-west");
```

## 🔌 Lavalink v4 Plugin Support

Rias provides complete support for the Lavalink v4 plugin system, allowing you to discover, manage, and interact with plugins programmatically.

### Plugin Discovery

Plugins are automatically discovered when nodes connect. You can also query plugin information at any time:

```typescript
// Get server info including plugins from all nodes
const infoMap = await rias.getInfo();
for (const [nodeId, info] of infoMap) {
  console.log(`Node ${nodeId}: Lavalink ${info.version.semver}`);
  console.log(
    `Plugins: ${info.plugins.map((p) => `${p.name}@${p.version}`).join(", ")}`
  );
}

// Get all plugins from all nodes
const pluginsMap = await rias.getAllPlugins();

// Get unique plugins across all nodes
const uniquePlugins = await rias.getUniquePlugins();
console.log(
  `Available plugins: ${uniquePlugins.map((p) => p.name).join(", ")}`
);

// Check if a specific plugin is available
const hasSpotify = await rias.hasPlugin("lavasrc");
if (hasSpotify) {
  console.log("Spotify plugin is available!");
}

// Get nodes that have a specific plugin
const nodesWithPlugin = await rias.getNodesWithPlugin("lavasrc");
console.log(
  `Plugin available on: ${nodesWithPlugin.map((n) => n.id).join(", ")}`
);
```

### Per-Node Plugin Queries

You can also query plugin information from specific nodes:

```typescript
const node = rias.getNode("main");

// Get all plugins on this node
const plugins = await node.getPlugins();

// Check if plugin exists
const hasPlugin = await node.hasPlugin("lavasrc");

// Get specific plugin info
const pluginInfo = await node.getPluginInfo("lavasrc");
if (pluginInfo) {
  console.log(`${pluginInfo.name} version ${pluginInfo.version}`);
}

// Get other server info
const version = await node.getVersion(); // "4.0.0"
const sourceManagers = await node.getSourceManagers(); // ["youtube", "spotify", ...]
const filters = await node.getFilters(); // ["equalizer", "karaoke", ...]
```

### Plugin Filters

Plugins can provide custom audio filters. Use them with the player's filter system:

```typescript
// Apply plugin-specific filters along with built-in filters
await player.setFilters({
  // Built-in filters
  volume: 1.0,
  equalizer: EqualizerPresets.bass,

  // Plugin filters
  pluginFilters: {
    "my-plugin": {
      customSetting: "value",
      intensity: 0.8,
    },
    "another-plugin": {
      enabled: true,
      mode: "advanced",
    },
  },
});
```

### Custom Plugin Requests

Make custom API requests to plugin-specific endpoints:

```typescript
// Make a request to a plugin endpoint (automatically finds a node with the plugin)
const response = await rias.pluginRequest<MyResponseType>("lavasrc", "lyrics", {
  method: "POST",
  body: JSON.stringify({ query: "song name" }),
});

// Or make a request to a specific node
const node = rias.getNode("main");
const nodeResponse = await node.pluginRequest<MyResponseType>(
  "lavasrc",
  "lyrics",
  {
    method: "POST",
    body: JSON.stringify({ query: "song name" }),
  }
);
```

### Plugin Events

Listen for plugin-related events:

```typescript
// Emitted when a plugin is discovered on a node
rias.on("pluginLoaded", (nodeId, plugin) => {
  console.log(
    `Plugin loaded: ${plugin.name}@${plugin.version} on node ${nodeId}`
  );
});

// Emitted when server info is updated (includes plugin list)
rias.on("infoUpdate", (nodeId, info) => {
  console.log(`Node ${nodeId} has ${info.plugins.length} plugins`);
  console.log(`Lavalink version: ${info.version.semver}`);
  console.log(`Source managers: ${info.sourceManagers.join(", ")}`);
});
```

### Plugin Cache

Plugin information is cached for 5 minutes to reduce API calls. You can force refresh:

```typescript
// Force refresh the cache
const plugins = await rias.getUniquePlugins(true);
const info = await node.getInfo(true);
```

### Complete Plugin Example

```typescript
import { Rias } from "@lealt/rias";

// ... Rias initialization ...

// Wait for node to be ready and discover plugins
rias.once("ready", async (nodeId) => {
  console.log(`Node ${nodeId} is ready!`);

  // Get server information
  const node = rias.getNode(nodeId);
  const info = await node.getInfo();

  console.log(`Lavalink ${info.version.semver}`);
  console.log(`JVM: ${info.jvm}`);
  console.log(`Lavaplayer: ${info.lavaplayer}`);

  // List all plugins
  console.log("\nInstalled Plugins:");
  for (const plugin of info.plugins) {
    console.log(`  - ${plugin.name}@${plugin.version}`);
  }

  // List available source managers
  console.log("\nSource Managers:");
  console.log(`  ${info.sourceManagers.join(", ")}`);

  // List available filters
  console.log("\nAvailable Filters:");
  console.log(`  ${info.filters.join(", ")}`);

  // Check for specific plugin
  if (await node.hasPlugin("lavasrc")) {
    console.log("\nLavaSrc plugin detected!");
    console.log("Spotify, Apple Music, and Deezer support available.");
  }
});

// Listen for new plugins being loaded
rias.on("pluginLoaded", (nodeId, plugin) => {
  console.log(`[${nodeId}] Loaded: ${plugin.name}@${plugin.version}`);
});
```

## 🎵 Reference Music Bot

A complete, production-ready music bot implementation is included in the `music-bot/` directory. It demonstrates:

- **Full Queue System** - Auto-play, loop modes, shuffle
- **12 Commands** - play, pause, resume, skip, stop, queue, shuffle, loop, volume, nowplaying, info, help
- **Player Events** - Centralized event handling with announcements
- **Library Utilities** - Uses formatTime, createProgressBar, formatBytes, etc.
- **Proper Error Handling** - Graceful failures and user feedback
- **TypeScript Best Practices** - Type-safe, clean architecture

### Getting Started

```bash
cd music-bot
npm install
cp .env.example .env  # Configure your bot token and Lavalink
npm run dev           # Start in development mode
```

See the [Architecture Guide](./QuickStart.md) for detailed documentation.

## 🌍 Node Selection Strategies

Rias provides 5 different strategies for selecting the optimal node for your players:

### LoadBalanced (Default)

Selects nodes based on a combination of CPU load and active player count. This provides the best overall performance in most scenarios.

```typescript
nodeSelectionStrategy: NodeSelectionStrategy.LoadBalanced;
```

**Formula:** `Load = CPU Load × (1 + Players × 0.1)`

### Regional

Prefers nodes in the same region as specified when creating a player. Falls back to load-balanced selection if no regional nodes are available.

```typescript
nodes: [
  { id: "us-west", host: "...", region: "us-west", ... },
  { id: "eu-central", host: "...", region: "eu-central", ... },
],
nodeSelectionStrategy: NodeSelectionStrategy.Regional,

// Create player with region preference
const player = rias.create(guildId, "us-west");
```

**Use Case:** Reduce latency for users in specific geographic regions.

### LeastPlayers

Selects the node with the lowest number of active players. Useful for distributing load evenly across nodes.

```typescript
nodeSelectionStrategy: NodeSelectionStrategy.LeastPlayers;
```

**Use Case:** Balance player distribution across all available nodes.

### LeastLoad

Selects the node with the lowest CPU load. Prioritizes performance over player distribution.

```typescript
nodeSelectionStrategy: NodeSelectionStrategy.LeastLoad;
```

**Use Case:** Maximize performance by always using the least busy node.

### Priority

Selects nodes based on configured priority values (lower number = higher priority).

```typescript
nodes: [
  { id: "primary", host: "...", priority: 1, ... },
  { id: "backup", host: "...", priority: 10, ... },
],
nodeSelectionStrategy: NodeSelectionStrategy.Priority
```

**Use Case:** Implement primary/backup node configurations or prefer premium nodes.

---

## 📚 API Reference

### Rias

Main client for managing Lavalink connections and players.

#### Constructor Options

```typescript
interface RiasOptions {
  nodes: NodeOptions[]; // Array of node configurations
  send: (guildId, payload) => void; // Function to send voice updates
  clientName?: string; // Optional client name
  userAgent?: string; // User agent sent to Lavalink (default: "Rias")
  defaultSearchSource?: SearchSource; // Default search source
  nodeSelectionStrategy?: NodeSelectionStrategy; // Node selection strategy (default: LoadBalanced)
  debug?: boolean; // Enable debug mode
}

interface NodeOptions {
  id: string; // Unique node identifier
  host: string; // Node hostname
  port: number; // Node port
  password: string; // Node password
  secure?: boolean; // Use WSS/HTTPS
  region?: string; // Region identifier for regional node selection
  priority?: number; // Priority for node selection (lower = higher priority, default: 0)
  resumeKey?: string; // Resume key for session persistence
  resumeTimeout?: number; // Resume timeout in seconds
  maxReconnectAttempts?: number; // Max reconnection attempts (default: 5)
  reconnectDelay?: number; // Base reconnection delay in ms (default: 3000)
}

enum NodeSelectionStrategy {
  LoadBalanced = "load-balanced", // Select based on CPU load and player count (default)
  Regional = "regional", // Prefer nodes in the same region
  LeastPlayers = "least-players", // Select node with lowest player count
  LeastLoad = "least-load", // Select node with lowest CPU load
  Priority = "priority", // Select nodes by configured priority
}
```

#### Methods

- `init()` - Initialize and connect to all nodes
- `create(guildId: string, region?: string)` - Create or get a player for a guild (optional region for Regional strategy)
- `get(guildId: string)` - Get an existing player
- `destroy(guildId: string)` - Destroy a player
- `destroyAll()` - Destroy all players
- `search(query: string, source?: SearchSource)` - Search for tracks
- `load(identifier: string)` - Load tracks from URL or identifier
- `decodeTrack(encoded: string)` - Decode a single track
- `decodeTracks(encoded: string[])` - Decode multiple tracks
- `getConnectedNodes()` - Get all connected nodes
- `getNode(nodeId: string)` - Get a specific node
- `getStats()` - Get statistics for all nodes
- `shutdown(timeout?: number)` - Gracefully shutdown Rias

##### Plugin Methods

- `getInfo(forceRefresh?: boolean)` - Get Lavalink server info from all nodes
- `getAllPlugins(forceRefresh?: boolean)` - Get plugins from all nodes
- `getUniquePlugins(forceRefresh?: boolean)` - Get unique plugins across all nodes
- `hasPlugin(pluginName: string, forceRefresh?: boolean)` - Check if plugin is available
- `getNodesWithPlugin(pluginName: string, forceRefresh?: boolean)` - Get nodes with specific plugin
- `pluginRequest<T>(pluginName: string, endpoint: string, options?)` - Make plugin-specific request

### Player

Represents a player for a specific guild.

#### Properties

- `guildId: string` - Guild ID
- `track: Track | null` - Current track
- `volume: number` - Current volume (0-1000)
- `paused: boolean` - Paused state
- `playing: boolean` - Playing state
- `position: number` - Current position in ms
- `connected: boolean` - Connection state
- `isDestroyed: boolean` - Whether player is destroyed

#### Methods

- `connect(channelId: string, options?)` - Connect to voice channel
- `disconnect()` - Disconnect from voice channel
- `play(options: PlayOptions)` - Play a track
- `stop()` - Stop playback
- `pause(state?: boolean)` - Pause/unpause playback
- `resume()` - Resume playback
- `seek(position: number)` - Seek to position
- `setVolume(volume: number)` - Set volume (0-1000)
- `setFilters(filters: FilterOptions)` - Apply filters
- `clearFilters()` - Clear all filters
- `destroy()` - Destroy the player

### Queue

Queue management for player tracks.

#### Properties

- `size: number` - Number of tracks in queue
- `isEmpty: boolean` - Whether queue is empty
- `duration: number` - Total duration of queued tracks
- `totalDuration: number` - Total duration including current track
- `current: Track | null` - Currently playing track
- `previous: Track | null` - Previously played track
- `loopMode: LoopMode` - Current loop mode

#### Methods

- `add(track: Track)` - Add a track
- `addMany(tracks: Track[])` - Add multiple tracks
- `insert(index: number, track: Track)` - Insert track at position
- `remove(index: number)` - Remove track at index
- `poll()` - Get and remove next track
- `peek()` - Get next track without removing
- `clear()` - Clear the queue
- `shuffle()` - Shuffle the queue
- `smartShuffle()` - Smart shuffle (avoids consecutive same artists)
- `skipTo(index: number)` - Skip to position
- `move(from: number, to: number)` - Move a track
- `swap(index1: number, index2: number)` - Swap two tracks
- `reverse()` - Reverse queue order
- `removeDuplicates()` - Remove duplicate tracks
- `filterByAuthor(author: string)` - Filter by author
- `filterByDuration(min: number, max: number)` - Filter by duration
- `filterBySource(source: string)` - Filter by source
- `removeByAuthor(author: string)` - Remove tracks by author
- `setLoopMode(mode: LoopMode)` - Set loop mode
- `toggleLoop()` - Toggle loop mode
- `getSummary()` - Get queue summary
- `clone()` - Clone the queue

## 🛠️ Utilities

### Equalizer Presets

```typescript
import { EqualizerPresets } from 'rias';

// Available presets:
- flat         - No changes
- boost        - General boost
- metal        - Metal music
- piano        - Piano emphasis
- bass         - Bass boost
- radio        - Radio-like sound
- treblebass   - Enhanced treble and bass
- nightcore    - Nightcore effect
- vaporwave    - Vaporwave effect
```

### Helper Functions

```typescript
import {
  formatTime, // Format ms to MM:SS or HH:MM:SS
  parseTime, // Parse time string to ms
  getThumbnail, // Get track thumbnail
  createProgressBar, // Create progress bar
  formatBytes, // Format bytes to human-readable
  percentage, // Calculate percentage
  clamp, // Clamp number between min/max
} from "@lealt/rias";
```

## ⚠️ Error Codes

```typescript
enum RiasErrorCode {
  NODE_NOT_CONNECTED,
  NODE_NOT_READY,
  NO_AVAILABLE_NODES,
  PLAYER_NOT_FOUND,
  NO_TRACK_PLAYING,
  INVALID_VOLUME,
  INVALID_POSITION,
  INVALID_CHANNEL,
  TRACK_LOAD_FAILED,
  TIMEOUT,
  WEBSOCKET_ERROR,
  REST_ERROR,
}
```

## 🔧 Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Lint
npm run lint

# Format code
npm run format

# Type check
npm run typecheck
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for [Lavalink v4](https://github.com/lavalink-devs/Lavalink)
- Powered by [Discord.js](https://discord.js.org)
- Inspired by the Discord music bot community

## 💬 Support

- 📫 [Report Issues](https://github.com/lealtt/rias/issues)
- 💡 [Request Features](https://github.com/lealtt/rias/issues/new)
- 📖 [Architecture Guide](./QuickStart.md)
- 🎵 [Music Bot Example](./music-bot/)

## 🌟 Show Your Support

If you find this library helpful, please consider giving it a star on [GitHub](https://github.com/lealtt/rias)!

---

<div align="center">
  Made with ❤️ by <a href="https://github.com/lealtt">@lealt</a>
</div>
