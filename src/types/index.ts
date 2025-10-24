/**
 * Branded types for type safety
 */
export type GuildId = string & { readonly __brand: "GuildId" };
export type ChannelId = string & { readonly __brand: "ChannelId" };
export type UserId = string & { readonly __brand: "UserId" };
export type NodeId = string & { readonly __brand: "NodeId" };

/**
 * Configuration options for Rias client
 */
export interface RiasOptions {
  /** Array of Lavalink nodes to connect to */
  nodes: NodeOptions[];
  /** Optional client name for identification */
  clientName?: string;
  /** User agent string sent to Lavalink nodes (defaults to "Rias") */
  userAgent?: string;
  /** Send voice updates payload to Discord */
  send: (guildId: string, payload: Record<string, unknown>) => void;
  /** User ID of the bot */
  userId?: string;
  /** Default search source */
  defaultSearchSource?: SearchSource;
  /** Node selection strategy (defaults to "load-balanced") */
  nodeSelectionStrategy?: NodeSelectionStrategy;
  /** Enable debug mode */
  debug?: boolean;
}

/**
 * Configuration for a single Lavalink node
 */
export interface NodeOptions {
  /** Unique identifier for the node */
  id: string;
  /** Hostname or IP address */
  host: string;
  /** Port number */
  port: number;
  /** Authorization password */
  password: string;
  /** Use secure connection (https/wss) */
  secure?: boolean;
  /** Region identifier for node selection */
  region?: string;
  /** Priority for node selection (lower = higher priority, defaults to 0) */
  priority?: number;
  /** Key for resuming node session */
  resumeKey?: string;
  /** Timeout for resuming node session (in seconds) */
  resumeTimeout?: number;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  /** Base reconnection delay in milliseconds */
  reconnectDelay?: number;
}

/**
 * Lavalink track information
 */
export interface Track {
  /** Base64 encoded track data */
  encoded: string;
  /** Track metadata */
  info: TrackInfo;
  /** Plugin-specific data */
  pluginInfo?: Record<string, unknown>;
  /** User data attached to track */
  userData?: Record<string, unknown>;
}

/**
 * Track metadata
 */
export interface TrackInfo {
  /** Track identifier */
  identifier: string;
  /** Whether the track is seekable */
  isSeekable: boolean;
  /** Author of the track */
  author: string;
  /** Duration in milliseconds */
  length: number;
  /** Whether the track is a stream */
  isStream: boolean;
  /** Track position in milliseconds */
  position: number;
  /** Track title */
  title: string;
  /** Track source name */
  sourceName: string;
  /** Track URI */
  uri?: string;
  /** Artwork URL */
  artworkUrl?: string;
  /** ISRC code */
  isrc?: string;
}

/**
 * Decoded track response from Lavalink
 */
export interface DecodedTrack {
  encoded: string;
  info: TrackInfo;
  pluginInfo?: Record<string, unknown>;
}

/**
 * Load result types for Lavalink v4
 */
export enum LoadType {
  Track = "track",
  Playlist = "playlist",
  Search = "search",
  Empty = "empty",
  Error = "error",
}

/**
 * String literal union type derived from LoadType enum
 * This allows autocomplete when using string literals like: result.loadType === "empty"
 */
export type LoadTypeString = `${LoadType}`;

/**
 * Discriminated union for load tracks response
 */
export type LoadTracksResponse =
  | {
      loadType: LoadType.Track | "track";
      data: Track;
    }
  | {
      loadType: LoadType.Playlist | "playlist";
      data: PlaylistInfo;
    }
  | {
      loadType: LoadType.Search | "search";
      data: Track[];
    }
  | {
      loadType: LoadType.Empty | "empty";
      data: null;
    }
  | {
      loadType: LoadType.Error | "error";
      data: LoadError;
    };

/**
 * Playlist information
 */
export interface PlaylistInfo {
  info: {
    /** Playlist name */
    name: string;
    /** Selected track index */
    selectedTrack?: number;
  };
  /** Plugin-specific data */
  pluginInfo: Record<string, unknown>;
  /** Array of tracks in playlist */
  tracks: Track[];
}

/**
 * Load error information
 */
export interface LoadError {
  /** Error message */
  message: string;
  /** Error severity */
  severity: ErrorSeverity;
  /** Error cause */
  cause: string;
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  Common = "common",
  Suspicious = "suspicious",
  Fault = "fault",
}

/**
 * Exception information
 */
export interface Exception {
  /** Exception message */
  message: string;
  /** Exception severity */
  severity: ErrorSeverity;
  /** Exception cause */
  cause: string;
}

/**
 * Player state from Lavalink
 */
export interface PlayerState {
  /** Unix timestamp */
  time: number;
  /** Current track position in milliseconds */
  position: number;
  /** Whether the player is connected to voice gateway */
  connected: boolean;
  /** Ping to Discord voice server in milliseconds */
  ping: number;
}

/**
 * Track resolvable type
 */
export type TrackResolvable = string | Track;

/**
 * Player options for playing tracks
 */
export interface PlayOptions {
  /** Track to play (encoded string or Track object) */
  track: TrackResolvable;
  /** Start position in milliseconds */
  position?: number;
  /** End position in milliseconds */
  endTime?: number;
  /** Volume (0-1000) */
  volume?: number;
  /** Whether to pause immediately */
  paused?: boolean;
  /** Whether to replace current track */
  noReplace?: boolean;
}

/**
 * Voice connection information
 */
export interface VoiceState {
  /** Voice server token */
  token: string;
  /** Voice server endpoint */
  endpoint: string;
  /** Voice session ID */
  sessionId: string;
}

/**
 * Voice server update from Discord
 */
export interface VoiceServerUpdate {
  /** Voice server token */
  token: string;
  /** Guild ID */
  guild_id: string;
  /** Voice server endpoint */
  endpoint: string | null;
}

/**
 * Voice state update from Discord
 */
export interface VoiceStateUpdate {
  /** Guild ID */
  guild_id: string;
  /** User ID */
  user_id: string;
  /** Session ID */
  session_id: string;
  /** Voice channel ID */
  channel_id: string | null;
}

/**
 * Player events - using array-based signatures for EventEmitter compatibility
 */
export interface PlayerEvents {
  /** Track started playing */
  trackStart: [track: Track];
  /** Track ended */
  trackEnd: [track: Track, reason: TrackEndReasonString];
  /** Track got stuck */
  trackStuck: [track: Track, thresholdMs: number];
  /** Track exception occurred */
  trackException: [track: Track, exception: Exception];
  /** WebSocket closed */
  webSocketClosed: [code: number, reason: string, byRemote: boolean];
  /** Player state updated */
  playerUpdate: [state: PlayerState];
  /** Player was destroyed */
  destroy: [];
  /** Player error */
  error: [error: Error];
  /** Track(s) added to queue */
  queueAdd: [tracks: Track | Track[], queueLength: number];
  /** Track removed from queue */
  queueRemove: [track: Track, index: number];
  /** Queue cleared */
  queueClear: [count: number];
  /** Queue shuffled */
  queueShuffle: [queueLength: number];
  /** Queue ended (no more tracks) */
  queueEnd: [];
  /** Loop mode changed */
  loopSet: [mode: "none" | "track" | "queue"];
}

/**
 * Track end reasons from Lavalink v4
 */
export enum TrackEndReason {
  Finished = "finished",
  LoadFailed = "loadFailed",
  Stopped = "stopped",
  Replaced = "replaced",
  Cleanup = "cleanup",
}

/**
 * String literal union type derived from TrackEndReason enum
 * This allows autocomplete when using string literals like: reason === "finished"
 */
export type TrackEndReasonString = `${TrackEndReason}`;

/**
 * Node events - using array-based signatures for EventEmitter compatibility
 */
export interface NodeEvents {
  /** Node connected */
  connect: [nodeId: string];
  /** Node reconnecting */
  reconnect: [nodeId: string, attempt: number, delay: number];
  /** Node disconnected */
  disconnect: [nodeId: string, reason: string, code: number];
  /** Node error */
  error: [nodeId: string, error: Error];
  /** Node raw event */
  raw: [nodeId: string, data: Record<string, unknown>];
  /** Node ready */
  ready: [nodeId: string, sessionId: string];
  /** Node stats update */
  stats: [nodeId: string, stats: NodeStats];
  /** Player error */
  playerError: [guildId: string, error: Error];
  /** Plugin discovered/loaded */
  pluginLoaded: [nodeId: string, plugin: PluginInfo];
  /** Server info updated */
  infoUpdate: [nodeId: string, info: LavalinkInfo];
}

/**
 * Lavalink event types
 */
export enum LavalinkEventType {
  TrackStart = "TrackStartEvent",
  TrackEnd = "TrackEndEvent",
  TrackException = "TrackExceptionEvent",
  TrackStuck = "TrackStuckEvent",
  WebSocketClosed = "WebSocketClosedEvent",
}

/**
 * Lavalink operation codes
 */
export enum OpCode {
  Ready = "ready",
  PlayerUpdate = "playerUpdate",
  Stats = "stats",
  Event = "event",
}

/**
 * Node selection strategy
 */
export enum NodeSelectionStrategy {
  /** Select based on CPU load and player count */
  LoadBalanced = "load-balanced",
  /** Prefer nodes in the same region */
  Regional = "regional",
  /** Select node with lowest player count */
  LeastPlayers = "least-players",
  /** Select node with lowest latency/ping */
  LeastLoad = "least-load",
  /** Prefer nodes by configured priority */
  Priority = "priority",
}

/**
 * Search sources supported by Lavalink
 */
export type SearchSource =
  | "ytsearch"
  | "ytmsearch"
  | "scsearch"
  | "spsearch"
  | "amsearch"
  | "dzsearch"
  | "ymsearch";

/**
 * Search source prefixes for Lavalink
 */
export enum SearchPlatform {
  YouTube = "ytsearch",
  YouTubeMusic = "ytmsearch",
  SoundCloud = "scsearch",
  Spotify = "spsearch",
  AppleMusic = "amsearch",
  Deezer = "dzsearch",
  YandexMusic = "ymsearch",
}

/**
 * Equalizer band (0-14)
 */
export interface EqualizerBand {
  /** Band index (0-14) */
  band: number;
  /** Gain (-0.25 to 1.0) */
  gain: number;
}

/**
 * Filter options for audio manipulation
 */
export interface FilterOptions {
  /** Volume (0.0 to 5.0) */
  volume?: number;
  /** Equalizer bands */
  equalizer?: EqualizerBand[];
  /** Karaoke filter */
  karaoke?: KaraokeOptions | null;
  /** Timescale filter */
  timescale?: TimescaleOptions | null;
  /** Tremolo filter */
  tremolo?: TremoloOptions | null;
  /** Vibrato filter */
  vibrato?: VibratoOptions | null;
  /** Rotation filter */
  rotation?: RotationOptions | null;
  /** Distortion filter */
  distortion?: DistortionOptions | null;
  /** Channel mix filter */
  channelMix?: ChannelMixOptions | null;
  /** Low pass filter */
  lowPass?: LowPassOptions | null;
}

/**
 * Empty filters constant for clearing all filters
 */
export const EMPTY_FILTERS: FilterOptions = {
  volume: 1.0,
  equalizer: [],
  karaoke: null,
  timescale: null,
  tremolo: null,
  vibrato: null,
  rotation: null,
  distortion: null,
  channelMix: null,
  lowPass: null,
};

export interface KaraokeOptions {
  level?: number;
  monoLevel?: number;
  filterBand?: number;
  filterWidth?: number;
}

export interface TimescaleOptions {
  speed?: number;
  pitch?: number;
  rate?: number;
}

export interface TremoloOptions {
  frequency?: number;
  depth?: number;
}

export interface VibratoOptions {
  frequency?: number;
  depth?: number;
}

export interface RotationOptions {
  rotationHz?: number;
}

export interface DistortionOptions {
  sinOffset?: number;
  sinScale?: number;
  cosOffset?: number;
  cosScale?: number;
  tanOffset?: number;
  tanScale?: number;
  offset?: number;
  scale?: number;
}

export interface ChannelMixOptions {
  leftToLeft?: number;
  leftToRight?: number;
  rightToLeft?: number;
  rightToRight?: number;
}

export interface LowPassOptions {
  smoothing?: number;
}

/**
 * Node statistics from Lavalink
 */
export interface NodeStats {
  /** Number of players */
  players: number;
  /** Number of playing players */
  playingPlayers: number;
  /** Uptime in milliseconds */
  uptime: number;
  /** Memory stats */
  memory: MemoryStats;
  /** CPU stats */
  cpu: CpuStats;
  /** Frame stats (if available) */
  frameStats: FrameStats | null;
}

export interface MemoryStats {
  /** Free memory */
  free: number;
  /** Used memory */
  used: number;
  /** Allocated memory */
  allocated: number;
  /** Reservable memory */
  reservable: number;
}

export interface CpuStats {
  /** Number of CPU cores */
  cores: number;
  /** System load */
  systemLoad: number;
  /** Lavalink load */
  lavalinkLoad: number;
}

export interface FrameStats {
  /** Sent frames */
  sent: number;
  /** Nulled frames */
  nulled: number;
  /** Deficit frames */
  deficit: number;
}

/**
 * REST API update player payload
 */
export interface UpdatePlayerPayload {
  /** Encoded track to play */
  encodedTrack?: string | null;
  /** Track identifier */
  identifier?: string;
  /** Start position in milliseconds */
  position?: number;
  /** End position in milliseconds */
  endTime?: number;
  /** Volume (0-1000) */
  volume?: number;
  /** Paused state */
  paused?: boolean;
  /** Filters to apply (includes plugin filters) */
  filters?: ExtendedFilterOptions;
  /** Voice state */
  voice?: VoiceState;
}

/**
 * Player info from REST API
 */
export interface PlayerInfo {
  /** Guild ID */
  guildId: string;
  /** Current track */
  track?: Track;
  /** Volume */
  volume: number;
  /** Paused state */
  paused: boolean;
  /** Player state */
  state: PlayerState;
  /** Voice state */
  voice: VoiceState;
  /** Applied filters (includes plugin filters) */
  filters: ExtendedFilterOptions;
}

/**
 * Rias error codes
 */
export enum RiasErrorCode {
  NODE_NOT_CONNECTED = "NODE_NOT_CONNECTED",
  NODE_NOT_READY = "NODE_NOT_READY",
  NO_AVAILABLE_NODES = "NO_AVAILABLE_NODES",
  PLAYER_NOT_FOUND = "PLAYER_NOT_FOUND",
  NO_TRACK_PLAYING = "NO_TRACK_PLAYING",
  INVALID_VOLUME = "INVALID_VOLUME",
  INVALID_POSITION = "INVALID_POSITION",
  INVALID_CHANNEL = "INVALID_CHANNEL",
  TRACK_LOAD_FAILED = "TRACK_LOAD_FAILED",
  TIMEOUT = "TIMEOUT",
  WEBSOCKET_ERROR = "WEBSOCKET_ERROR",
  REST_ERROR = "REST_ERROR",
}

/**
 * Custom Rias error class
 */
export class RiasError extends Error {
  public code: RiasErrorCode;
  public details?: unknown;

  constructor(code: RiasErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "RiasError";
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Lavalink plugin information
 */
export interface PluginInfo {
  /** Plugin name */
  name: string;
  /** Plugin version */
  version: string;
}

/**
 * Lavalink version information
 */
export interface VersionInfo {
  /** Semantic version string (e.g., "4.0.0") */
  semver: string;
  /** Major version number */
  major: number;
  /** Minor version number */
  minor: number;
  /** Patch version number */
  patch: number;
  /** Pre-release identifier (e.g., "beta.1") */
  preRelease?: string | null;
  /** Build metadata */
  build?: string | null;
}

/**
 * Git commit information
 */
export interface GitInfo {
  /** Git branch */
  branch: string;
  /** Commit hash */
  commit: string;
  /** Commit timestamp (Unix milliseconds) */
  commitTime: number;
}

/**
 * Complete Lavalink server information
 */
export interface LavalinkInfo {
  /** Version information */
  version: VersionInfo;
  /** Build timestamp (Unix milliseconds) */
  buildTime: number;
  /** Git information */
  git: GitInfo;
  /** JVM version */
  jvm: string;
  /** Lavaplayer version */
  lavaplayer: string;
  /** Array of enabled source managers */
  sourceManagers: string[];
  /** Array of enabled filters */
  filters: string[];
  /** Array of installed plugins */
  plugins: PluginInfo[];
}

/**
 * Plugin-specific filters map
 * Key is the plugin name, value is plugin-specific configuration
 */
export type PluginFilters = Record<string, Record<string, unknown>>;

/**
 * Extended filter options with plugin support
 */
export interface ExtendedFilterOptions extends FilterOptions {
  /** Plugin-specific filters */
  pluginFilters?: PluginFilters;
}
