import { EventEmitter } from "events";
import type { Node } from "./Node.js";
import type {
  Track,
  PlayOptions,
  PlayerState,
  FilterOptions,
  VoiceServerUpdate,
  VoiceStateUpdate,
  PlayerEvents,
  UpdatePlayerPayload,
  VoiceState,
  RiasError,
  RiasErrorCode,
  TrackResolvable,
  Exception,
  TrackEndReasonString,
} from "./types/index.js";
import { EMPTY_FILTERS } from "./types/index.js";
import { ValidationUtils } from "./utils/validation.js";
import { Queue, LoopMode } from "./Queue.js";

/**
 * Represents a player for a specific guild
 */
export class Player extends EventEmitter<PlayerEvents> {
  public readonly guildId: string;
  public node: Node;

  public track: Track | null = null;
  public voiceChannel: string | null = null;
  public textChannel: string | null = null;
  public volume = 100;
  public paused = false;
  public playing = false;
  public position = 0;
  public connected = false;
  public queue: Queue = new Queue();
  public autoplay = true;

  private voiceServer: VoiceServerUpdate | null = null;
  private voiceState: VoiceStateUpdate | null = null;
  private destroyed = false;

  constructor(guildId: string, node: Node) {
    super();
    this.guildId = guildId;
    this.node = node;

    // Forward node events to player
    this.setupNodeListeners();
  }

  /**
   * Check if player is destroyed
   */
  public get isDestroyed(): boolean {
    return this.destroyed;
  }

  /**
   * Connect to a voice channel
   */
  public connect(
    channelId: string,
    options?: { mute?: boolean; deaf?: boolean }
  ): void {
    this.checkDestroyed();

    if (!ValidationUtils.isValidChannelId(channelId)) {
      throw this.createError(
        "INVALID_CHANNEL" as RiasErrorCode,
        `Invalid channel ID: ${channelId}. Channel IDs must be a 17-20 digit string.`
      );
    }

    this.voiceChannel = channelId;

    this.node.emit("voiceUpdate", {
      guild_id: this.guildId,
      channel_id: channelId,
      self_mute: options?.mute ?? false,
      self_deaf: options?.deaf ?? true,
    });
  }

  /**
   * Disconnect from the voice channel
   */
  public async disconnect(): Promise<void> {
    this.checkDestroyed();

    this.voiceChannel = null;
    this.connected = false;

    try {
      this.node.emit("voiceUpdate", {
        guild_id: this.guildId,
        channel_id: null,
        self_mute: false,
        self_deaf: false,
      });

      // Destroy the player
      await this.destroy();
    } catch (error) {
      this.emit("error", error as Error);
      throw error;
    }
  }

  /**
   * Play a track
   */
  public async play(options: PlayOptions): Promise<void> {
    this.checkDestroyed();
    this.checkNodeReady();

    const track = this.resolveTrack(options.track);
    const noReplace = options.noReplace ?? false;

    const payload: UpdatePlayerPayload = {
      encodedTrack: track,
    };

    if (options.position !== undefined) {
      if (!ValidationUtils.isValidPosition(options.position)) {
        throw this.createError(
          "INVALID_POSITION" as RiasErrorCode,
          `Invalid position: ${options.position}. Must be a non-negative integer.`
        );
      }
      payload.position = options.position;
    }

    if (options.endTime !== undefined) {
      if (!ValidationUtils.isValidPosition(options.endTime)) {
        throw this.createError(
          "INVALID_POSITION" as RiasErrorCode,
          `Invalid endTime: ${options.endTime}. Must be a non-negative integer.`
        );
      }
      payload.endTime = options.endTime;
    }

    if (options.volume !== undefined) {
      if (!ValidationUtils.isValidVolume(options.volume)) {
        throw this.createError(
          "INVALID_VOLUME" as RiasErrorCode,
          `Invalid volume: ${options.volume}. Must be between 0 and 1000.`
        );
      }
      payload.volume = options.volume;
      this.volume = options.volume;
    }

    if (options.paused !== undefined) {
      payload.paused = options.paused;
      this.paused = options.paused;
    }

    try {
      await this.node.updatePlayer(this.guildId, payload, noReplace);
      this.playing = true;
    } catch (error) {
      this.emit("error", error as Error);
      throw error;
    }
  }

  /**
   * Stop playback
   */
  public async stop(): Promise<void> {
    this.checkDestroyed();
    this.checkNodeReady();

    try {
      await this.node.updatePlayer(this.guildId, { encodedTrack: null });
      this.track = null;
      this.playing = false;
    } catch (error) {
      this.emit("error", error as Error);
      throw error;
    }
  }

  /**
   * Pause playback
   */
  public async pause(state = true): Promise<void> {
    this.checkDestroyed();
    this.checkNodeReady();

    try {
      await this.node.updatePlayer(this.guildId, { paused: state });
      this.paused = state;
    } catch (error) {
      this.emit("error", error as Error);
      throw error;
    }
  }

  /**
   * Resume playback
   */
  public async resume(): Promise<void> {
    return this.pause(false);
  }

  /**
   * Seek to a position in the track
   */
  public async seek(position: number): Promise<void> {
    this.checkDestroyed();
    this.checkNodeReady();

    if (!this.track) {
      throw this.createError(
        "NO_TRACK_PLAYING" as RiasErrorCode,
        "No track is currently playing"
      );
    }

    if (!ValidationUtils.isValidPosition(position)) {
      throw this.createError(
        "INVALID_POSITION" as RiasErrorCode,
        `Invalid position: ${position}. Must be a non-negative integer.`
      );
    }

    if (!this.track.info.isSeekable) {
      throw this.createError(
        "INVALID_POSITION" as RiasErrorCode,
        "Current track is not seekable"
      );
    }

    try {
      await this.node.updatePlayer(this.guildId, { position: position });
      this.position = position;
    } catch (error) {
      this.emit("error", error as Error);
      throw error;
    }
  }

  /**
   * Set the player volume
   */
  public async setVolume(volume: number): Promise<void> {
    this.checkDestroyed();
    this.checkNodeReady();

    if (!ValidationUtils.isValidVolume(volume)) {
      throw this.createError(
        "INVALID_VOLUME" as RiasErrorCode,
        `Invalid volume: ${volume}. Must be between 0 and 1000.`
      );
    }

    try {
      await this.node.updatePlayer(this.guildId, { volume: volume });
      this.volume = volume;
    } catch (error) {
      this.emit("error", error as Error);
      throw error;
    }
  }

  /**
   * Apply filters to the player
   */
  public async setFilters(filters: FilterOptions): Promise<void> {
    this.checkDestroyed();
    this.checkNodeReady();

    try {
      await this.node.updatePlayer(this.guildId, { filters: filters });
    } catch (error) {
      this.emit("error", error as Error);
      throw error;
    }
  }

  /**
   * Clear all filters
   */
  public async clearFilters(): Promise<void> {
    this.checkDestroyed();
    this.checkNodeReady();

    try {
      await this.node.updatePlayer(this.guildId, { filters: EMPTY_FILTERS });
    } catch (error) {
      this.emit("error", error as Error);
      throw error;
    }
  }

  /**
   * Add a track to the queue
   */
  public addTrack(track: Track): void {
    this.checkDestroyed();
    this.queue.add(track);
    this.emit("queueAdd", track, this.queue.size);
  }

  /**
   * Add multiple tracks to the queue
   */
  public addTracks(tracks: Track[]): void {
    this.checkDestroyed();
    this.queue.addMany(tracks);
    this.emit("queueAdd", tracks, this.queue.size);
  }

  /**
   * Remove a track from the queue by index
   */
  public removeTrack(index: number): Track | undefined {
    this.checkDestroyed();
    const removed = this.queue.remove(index);
    if (removed) {
      this.emit("queueRemove", removed, index);
    }
    return removed;
  }

  /**
   * Clear the queue
   */
  public clearQueue(): void {
    this.checkDestroyed();
    const count = this.queue.size;
    this.queue.clear();
    this.emit("queueClear", count);
  }

  /**
   * Shuffle the queue using Fisher-Yates algorithm
   */
  public shuffleQueue(): void {
    this.checkDestroyed();
    this.queue.shuffle();
    this.emit("queueShuffle", this.queue.size);
  }

  /**
   * Smart shuffle - avoids consecutive tracks from same artist
   */
  public smartShuffleQueue(): void {
    this.checkDestroyed();
    this.queue.smartShuffle();
    this.emit("queueShuffle", this.queue.size);
  }

  /**
   * Skip to the next track in the queue
   */
  public async skip(): Promise<boolean> {
    this.checkDestroyed();

    if (this.queue.isEmpty) {
      await this.stop();
      this.emit("queueEnd");
      return false;
    }

    const next = this.queue.poll();
    if (!next) {
      return false;
    }

    await this.play({ track: next });
    return true;
  }

  /**
   * Set loop mode
   */
  public setLoop(mode: LoopMode | "none" | "track" | "queue"): void {
    this.checkDestroyed();
    const loopMode =
      typeof mode === "string"
        ? LoopMode[
            (mode.charAt(0).toUpperCase() +
              mode.slice(1)) as keyof typeof LoopMode
          ]
        : mode;
    this.queue.setLoopMode(loopMode);
    this.emit("loopSet", mode);
  }

  /**
   * Update voice server information
   */
  public voiceServerUpdate(update: VoiceServerUpdate): void {
    if (this.destroyed) return;

    this.voiceServer = update;
    this.attemptConnection();
  }

  /**
   * Update voice state information
   */
  public voiceStateUpdate(update: VoiceStateUpdate): void {
    if (this.destroyed) return;

    if (update.channel_id) {
      this.voiceChannel = update.channel_id;
      this.voiceState = update;
      this.attemptConnection();
    } else {
      this.voiceChannel = null;
      this.connected = false;
    }
  }

  /**
   * Destroy the player
   */
  public async destroy(): Promise<void> {
    if (this.destroyed) return;

    this.destroyed = true;

    try {
      await this.node.destroyPlayer(this.guildId);
    } catch (error) {
      // Log destruction errors for debugging
      console.error(`[Player ${this.guildId}] Error during destroy:`, error);
    }

    this.emit("destroy");
    this.removeAllListeners();

    // Clean up state
    this.track = null;
    this.queue.clear();
    this.playing = false;
    this.paused = false;
    this.connected = false;
    this.voiceServer = null;
    this.voiceState = null;
  }

  /**
   * Resolve a track resolvable to an encoded string
   */
  private resolveTrack(track: TrackResolvable): string {
    return typeof track === "string" ? track : track.encoded;
  }

  /**
   * Attempt to establish voice connection with Lavalink
   */
  private async attemptConnection(): Promise<void> {
    if (this.destroyed) return;
    if (!this.voiceServer || !this.voiceState || !this.voiceServer.endpoint) {
      return;
    }

    const voiceState: VoiceState = {
      token: this.voiceServer.token,
      endpoint: this.voiceServer.endpoint,
      sessionId: this.voiceState.session_id,
    };

    try {
      await this.node.updatePlayer(this.guildId, { voice: voiceState });
      this.connected = true;
    } catch (error) {
      this.emit("error", error as Error);
    }
  }

  /**
   * Set up listeners for node events
   */
  private setupNodeListeners(): void {
    this.node.on(
      "event",
      (payload: {
        guildId: string;
        type: string;
        track?: Track;
        reason?: string;
        thresholdMs?: number;
        exception?: Exception;
        code?: number;
        byRemote?: boolean;
      }) => {
        if (payload.guildId !== this.guildId) return;
        if (this.destroyed) return;

        switch (payload.type) {
          case "TrackStartEvent":
            if (payload.track) {
              this.track = payload.track;
              this.playing = true;
              this.emit("trackStart", payload.track);
            }
            break;

          case "TrackEndEvent":
            if (payload.track && payload.reason) {
              const reason = payload.reason as TrackEndReasonString;
              this.playing = false;
              this.emit("trackEnd", payload.track, reason);

              // Auto-play next track if enabled and reason allows it
              if (
                this.autoplay &&
                (reason === "finished" || reason === "loadFailed")
              ) {
                this.playNext();
              }
            }
            break;

          case "TrackStuckEvent":
            if (payload.track && payload.thresholdMs !== undefined) {
              this.emit("trackStuck", payload.track, payload.thresholdMs);
            }
            break;

          case "TrackExceptionEvent":
            if (payload.track && payload.exception) {
              this.emit("trackException", payload.track, payload.exception);
            }
            break;

          case "WebSocketClosedEvent":
            if (
              payload.code !== undefined &&
              payload.reason &&
              payload.byRemote !== undefined
            ) {
              this.connected = false;
              this.emit(
                "webSocketClosed",
                payload.code,
                payload.reason,
                payload.byRemote
              );
            }
            break;
        }
      }
    );

    this.node.on(
      "playerUpdate",
      (payload: { guildId: string; state: PlayerState }) => {
        if (payload.guildId !== this.guildId) return;
        if (this.destroyed) return;

        this.position = payload.state.position;
        this.connected = payload.state.connected;
        this.emit("playerUpdate", payload.state as PlayerState);
      }
    );
  }

  /**
   * Play the next track in the queue (respects loop modes)
   */
  private playNext(): void {
    const next = this.queue.poll();

    if (!next) {
      this.emit("queueEnd");
      return;
    }

    this.play({ track: next }).catch((error) => {
      this.emit("error", error as Error);
    });
  }

  /**
   * Check if player is destroyed and throw if it is
   */
  private checkDestroyed(): void {
    if (this.destroyed) {
      throw this.createError(
        "PLAYER_NOT_FOUND" as RiasErrorCode,
        "Player has been destroyed"
      );
    }
  }

  /**
   * Check if node is ready and throw if it's not
   */
  private checkNodeReady(): void {
    if (!this.node.isReady) {
      throw this.createError(
        "NODE_NOT_READY" as RiasErrorCode,
        `Node ${this.node.id} is not ready. Please ensure the node is connected and initialized.`
      );
    }
  }

  /**
   * Create a standardized error
   */
  private createError(code: RiasErrorCode, message: string): RiasError {
    const error = new Error(message) as RiasError;
    error.name = "RiasError";
    error.code = code;
    return error;
  }
}
