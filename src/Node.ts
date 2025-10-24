import WebSocket from "ws";
import { EventEmitter } from "events";
import type {
  NodeOptions,
  LoadTracksResponse,
  UpdatePlayerPayload,
  NodeStats,
  DecodedTrack,
  LavalinkInfo,
  PluginInfo,
} from "./types/index.js";

/**
 * Connection states for the node
 */
enum ConnectionState {
  DISCONNECTED = "DISCONNECTED",
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  RECONNECTING = "RECONNECTING",
}

/**
 * Represents a connection to a single Lavalink node
 */
export class Node extends EventEmitter {
  public readonly id: string;
  public readonly region?: string;
  public readonly priority: number;
  private readonly host: string;
  private readonly port: number;
  private readonly password: string;
  private readonly secure: boolean;
  private readonly resumeKey?: string;
  private readonly resumeTimeout: number;
  private readonly maxReconnectAttempts: number;
  private readonly reconnectDelay: number;
  private readonly userAgent: string;

  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private sessionId: string | null = null;
  private clientId: string | null = null;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;

  public connected = false;
  public stats: NodeStats = {
    players: 0,
    playingPlayers: 0,
    uptime: 0,
    memory: { free: 0, used: 0, allocated: 0, reservable: 0 },
    cpu: { cores: 0, systemLoad: 0, lavalinkLoad: 0 },
    frameStats: null,
  };

  // Plugin support
  private lavalinkInfo: LavalinkInfo | null = null;
  private pluginCache: Map<string, PluginInfo> = new Map();
  private infoFetchTime: number = 0;
  private readonly INFO_CACHE_TTL = 300000; // 5 minutes cache TTL

  constructor(options: NodeOptions, userAgent = "Rias") {
    super();
    this.id = options.id;
    this.host = options.host;
    this.port = options.port;
    this.password = options.password;
    this.secure = options.secure ?? false;
    this.region = options.region;
    this.priority = options.priority ?? 0;
    this.resumeKey = options.resumeKey;
    this.resumeTimeout = options.resumeTimeout ?? 60;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
    this.reconnectDelay = options.reconnectDelay ?? 3000;
    this.userAgent = userAgent;
  }

  /**
   * Get the WebSocket URL for this node
   */
  private get wsUrl(): string {
    const protocol = this.secure ? "wss" : "ws";
    return `${protocol}://${this.host}:${this.port}/v4/websocket`;
  }

  /**
   * Get the REST URL for this node
   */
  private get restUrl(): string {
    const protocol = this.secure ? "https" : "http";
    return `${protocol}://${this.host}:${this.port}/v4`;
  }

  /**
   * Get the current connection state
   */
  public get state(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if the node is ready to accept operations
   */
  public get isReady(): boolean {
    return this.connected && this.sessionId !== null;
  }

  /**
   * Connect to the Lavalink node
   */
  public connect(clientId: string): void {
    if (this.connectionState === ConnectionState.CONNECTING) {
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    this.clientId = clientId;
    this.connectionState = ConnectionState.CONNECTING;

    try {
      const headers: Record<string, string> = {
        Authorization: this.password,
        "User-Id": clientId,
        "Client-Name": this.userAgent,
      };

      if (this.resumeKey) {
        headers["Session-Id"] = this.sessionId || "";
      }

      this.ws = new WebSocket(this.wsUrl, { headers });

      this.ws.on("open", () => this.onOpen());
      this.ws.on("message", (data) => this.onMessage(data));
      this.ws.on("close", (code, reason) => this.onClose(code, reason));
      this.ws.on("error", (error) => this.onError(error));
    } catch (error) {
      this.connectionState = ConnectionState.DISCONNECTED;
      this.emit("error", this.id, error);

      // Attempt reconnection if this was an unexpected error
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Disconnect from the Lavalink node
   */
  public disconnect(): void {
    if (!this.ws) return;

    this.connectionState = ConnectionState.DISCONNECTED;
    this.connected = false;

    // Clear reconnect timeout to prevent reconnection
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      this.ws.close(1000, "Client disconnect");
    } catch (error) {
      // Log disconnect errors in case of issues
      console.error(`[Node ${this.id}] Error during disconnect:`, error);
    }

    this.ws = null;

    // Don't clear sessionId if we have a resume key
    if (!this.resumeKey) {
      this.sessionId = null;
    }
  }

  /**
   * Send a payload to the Lavalink node
   */
  public send(payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(
        `Node ${this.id} is not connected (state: ${this.connectionState})`
      );
    }

    try {
      this.ws.send(JSON.stringify(payload));
    } catch (error) {
      this.emit("error", this.id, error);
      throw error;
    }
  }

  /**
   * Update player state via REST API (Lavalink v4)
   */
  public async updatePlayer(
    guildId: string,
    payload: UpdatePlayerPayload,
    noReplace: boolean = false
  ): Promise<void> {
    if (!this.sessionId) {
      throw new Error(
        `Node ${this.id} is not ready (no sessionId). Current state: ${this.connectionState}`
      );
    }

    const url = new URL(
      `${this.restUrl}/sessions/${this.sessionId}/players/${guildId}`
    );

    if (noReplace) {
      url.searchParams.append("noReplace", "true");
    }

    try {
      const response = await this.fetchWithTimeout(
        url.toString(),
        {
          method: "PATCH",
          headers: {
            Authorization: this.password,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
        5000
      ); // 5 second timeout

      if (!response.ok) {
        const errorBody = (await response
          .json()
          .catch(() => ({ message: "Unknown error" }))) as {
          message?: string;
        };
        throw new Error(
          `[${response.status}] Failed to update player: ${errorBody.message || "Unknown error"}`
        );
      }
    } catch (error) {
      this.emit("error", this.id, error);
      throw error;
    }
  }

  /**
   * Destroy a player via REST API (Lavalink v4)
   */
  public async destroyPlayer(guildId: string): Promise<void> {
    if (!this.sessionId) {
      throw new Error(
        `Node ${this.id} is not ready (no sessionId). Current state: ${this.connectionState}`
      );
    }

    const url = new URL(
      `${this.restUrl}/sessions/${this.sessionId}/players/${guildId}`
    );

    try {
      const response = await this.fetchWithTimeout(
        url.toString(),
        {
          method: "DELETE",
          headers: {
            Authorization: this.password,
          },
        },
        5000
      );

      if (!response.ok && response.status !== 404) {
        const errorBody = (await response
          .json()
          .catch(() => ({ message: "Unknown error" }))) as {
          message?: string;
        };
        throw new Error(
          `[${response.status}] Failed to destroy player: ${errorBody.message || "Unknown error"}`
        );
      }
    } catch (error: unknown) {
      // Only log non-404 errors (404 means player already destroyed)
      if (error instanceof Error && !error.message?.includes("404")) {
        console.error(
          `[Node ${this.id}] Error destroying player ${guildId}:`,
          error
        );
        this.emit("error", this.id, error);
      }
      throw error;
    }
  }

  /**
   * Load tracks from a search query or URL
   */
  public async loadTracks(identifier: string): Promise<LoadTracksResponse> {
    if (!this.connected) {
      throw new Error(
        `Node ${this.id} is not connected. Current state: ${this.connectionState}`
      );
    }

    const url = new URL(`${this.restUrl}/loadtracks`);
    url.searchParams.append("identifier", identifier);

    try {
      const response = await this.fetchWithTimeout(
        url.toString(),
        {
          headers: {
            Authorization: this.password,
          },
        },
        10000
      ); // 10 second timeout for searches

      if (!response.ok) {
        throw new Error(
          `Failed to load tracks: ${response.status} ${response.statusText}`
        );
      }

      return (await response.json()) as LoadTracksResponse;
    } catch (error) {
      this.emit("error", this.id, error);
      throw error;
    }
  }

  /**
   * Decode a single track
   */
  public async decodeTrack(encoded: string): Promise<DecodedTrack> {
    if (!this.connected) {
      throw new Error(
        `Node ${this.id} is not connected. Current state: ${this.connectionState}`
      );
    }

    const url = new URL(`${this.restUrl}/decodetrack`);
    url.searchParams.append("encodedTrack", encoded);

    try {
      const response = await this.fetchWithTimeout(
        url.toString(),
        {
          headers: {
            Authorization: this.password,
          },
        },
        5000
      );

      if (!response.ok) {
        throw new Error(
          `Failed to decode track: ${response.status} ${response.statusText}`
        );
      }

      return (await response.json()) as DecodedTrack;
    } catch (error) {
      this.emit("error", this.id, error);
      throw error;
    }
  }

  /**
   * Decode multiple tracks
   */
  public async decodeTracks(encoded: string[]): Promise<DecodedTrack[]> {
    if (!this.connected) {
      throw new Error(
        `Node ${this.id} is not connected. Current state: ${this.connectionState}`
      );
    }

    try {
      const response = await this.fetchWithTimeout(
        `${this.restUrl}/decodetracks`,
        {
          method: "POST",
          headers: {
            Authorization: this.password,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(encoded),
        },
        10000
      );

      if (!response.ok) {
        throw new Error(
          `Failed to decode tracks: ${response.status} ${response.statusText}`
        );
      }

      return (await response.json()) as DecodedTrack[];
    } catch (error) {
      this.emit("error", this.id, error);
      throw error;
    }
  }

  /**
   * Get Lavalink server information including version, plugins, and capabilities
   * Results are cached for 5 minutes to reduce API calls
   * @param forceRefresh - Force refresh the cache
   */
  public async getInfo(forceRefresh = false): Promise<LavalinkInfo> {
    if (!this.connected) {
      throw new Error(
        `Node ${this.id} is not connected. Current state: ${this.connectionState}`
      );
    }

    // Return cached info if available and not expired
    const now = Date.now();
    if (
      !forceRefresh &&
      this.lavalinkInfo &&
      now - this.infoFetchTime < this.INFO_CACHE_TTL
    ) {
      return this.lavalinkInfo;
    }

    try {
      const response = await this.fetchWithTimeout(
        `${this.restUrl}/info`,
        {
          headers: {
            Authorization: this.password,
          },
        },
        5000
      );

      if (!response.ok) {
        throw new Error(
          `Failed to get server info: ${response.status} ${response.statusText}`
        );
      }

      const info = (await response.json()) as LavalinkInfo;

      // Update cache
      this.lavalinkInfo = info;
      this.infoFetchTime = now;

      // Update plugin cache
      this.pluginCache.clear();
      for (const plugin of info.plugins) {
        this.pluginCache.set(plugin.name, plugin);
      }

      return info;
    } catch (error) {
      this.emit("error", this.id, error);
      throw error;
    }
  }

  /**
   * Get the list of installed plugins
   * @param forceRefresh - Force refresh the cache
   */
  public async getPlugins(forceRefresh = false): Promise<PluginInfo[]> {
    const info = await this.getInfo(forceRefresh);
    return info.plugins;
  }

  /**
   * Check if a specific plugin is installed
   * @param pluginName - The name of the plugin to check
   * @param forceRefresh - Force refresh the cache
   */
  public async hasPlugin(
    pluginName: string,
    forceRefresh = false
  ): Promise<boolean> {
    // Check cache first if not forcing refresh
    if (!forceRefresh && this.pluginCache.size > 0) {
      return this.pluginCache.has(pluginName);
    }

    await this.getInfo(forceRefresh);
    return this.pluginCache.has(pluginName);
  }

  /**
   * Get information about a specific plugin
   * @param pluginName - The name of the plugin
   * @param forceRefresh - Force refresh the cache
   */
  public async getPluginInfo(
    pluginName: string,
    forceRefresh = false
  ): Promise<PluginInfo | null> {
    // Check cache first if not forcing refresh
    if (!forceRefresh && this.pluginCache.size > 0) {
      return this.pluginCache.get(pluginName) ?? null;
    }

    await this.getInfo(forceRefresh);
    return this.pluginCache.get(pluginName) ?? null;
  }

  /**
   * Get the Lavalink version
   * @param forceRefresh - Force refresh the cache
   */
  public async getVersion(forceRefresh = false): Promise<string> {
    const info = await this.getInfo(forceRefresh);
    return info.version.semver;
  }

  /**
   * Get enabled source managers (e.g., youtube, soundcloud)
   * @param forceRefresh - Force refresh the cache
   */
  public async getSourceManagers(forceRefresh = false): Promise<string[]> {
    const info = await this.getInfo(forceRefresh);
    return info.sourceManagers;
  }

  /**
   * Get enabled filters
   * @param forceRefresh - Force refresh the cache
   */
  public async getFilters(forceRefresh = false): Promise<string[]> {
    const info = await this.getInfo(forceRefresh);
    return info.filters;
  }

  /**
   * Make a custom request to a plugin endpoint
   * This allows interaction with plugin-specific REST endpoints
   * @param pluginName - The plugin name
   * @param endpoint - The endpoint path (without leading slash)
   * @param options - Fetch options (method, body, etc.)
   */
  public async pluginRequest<T = unknown>(
    pluginName: string,
    endpoint: string,
    options: Omit<RequestInit, "headers"> & {
      headers?: Record<string, string>;
    } = {}
  ): Promise<T> {
    if (!this.connected) {
      throw new Error(
        `Node ${this.id} is not connected. Current state: ${this.connectionState}`
      );
    }

    // Verify plugin is installed
    const hasPlugin = await this.hasPlugin(pluginName);
    if (!hasPlugin) {
      throw new Error(
        `Plugin "${pluginName}" is not installed on node ${this.id}`
      );
    }

    // Build the plugin endpoint URL
    const cleanEndpoint = endpoint.startsWith("/")
      ? endpoint.slice(1)
      : endpoint;
    const url = `${this.restUrl}/${cleanEndpoint}`;

    try {
      const response = await this.fetchWithTimeout(
        url,
        {
          ...options,
          headers: {
            Authorization: this.password,
            "Content-Type": "application/json",
            ...options.headers,
          },
        },
        10000
      );

      if (!response.ok) {
        const errorBody = (await response
          .json()
          .catch(() => ({ message: "Unknown error" }))) as {
          message?: string;
        };
        throw new Error(
          `[${response.status}] Plugin request failed: ${errorBody.message || "Unknown error"}`
        );
      }

      // Check if response has content
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        return (await response.json()) as T;
      }

      // Return empty object for no-content responses
      return {} as T;
    } catch (error) {
      this.emit("error", this.id, error);
      throw error;
    }
  }

  /**
   * Fetch with timeout support
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private onOpen(): void {
    this.connected = true;
    this.connectionState = ConnectionState.CONNECTED;
    this.reconnectAttempts = 0;
    this.emit("connect", this.id);

    // Configure resuming if enabled
    if (this.resumeKey && !this.sessionId) {
      try {
        this.send({
          op: "configureResuming",
          key: this.resumeKey,
          timeout: this.resumeTimeout,
        });
      } catch (error) {
        this.emit("error", this.id, error);
      }
    }

    // Automatically fetch server info and discover plugins
    this.discoverPlugins().catch((error) => {
      // Don't throw, just emit error - plugin discovery is not critical
      this.emit("error", this.id, error);
    });
  }

  /**
   * Discover and cache plugins from the server
   * This is called automatically when the node connects
   */
  private async discoverPlugins(): Promise<void> {
    try {
      const info = await this.getInfo(true); // Force refresh on discovery

      // Emit info update event
      this.emit("infoUpdate", this.id, info);

      // Emit individual plugin loaded events
      for (const plugin of info.plugins) {
        this.emit("pluginLoaded", this.id, plugin);
      }
    } catch (error) {
      // Plugin discovery failure is not critical, so we just log it
      throw new Error(
        `Failed to discover plugins: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private onMessage(data: WebSocket.RawData): void {
    try {
      const payload = JSON.parse(data.toString());

      switch (payload.op) {
        case "ready":
          this.sessionId = payload.sessionId;
          this.emit("ready", payload);
          break;
        case "stats":
          this.stats = payload;
          this.emit("stats", payload);
          break;
        case "event":
          this.emit("event", payload);
          break;
        case "playerUpdate":
          this.emit("playerUpdate", payload);
          break;
        default:
          this.emit("raw", payload);
      }
    } catch (error) {
      this.emit("error", this.id, error);
    }
  }

  private onClose(code: number, reason: Buffer): void {
    this.connected = false;
    this.ws = null;

    const reasonStr = reason.toString();

    // Don't clear session if we're resuming
    if (!this.resumeKey || code === 1000) {
      this.sessionId = null;
    }

    // Only update state if we're not already reconnecting
    if (this.connectionState !== ConnectionState.RECONNECTING) {
      this.connectionState = ConnectionState.DISCONNECTED;
    }

    this.emit("disconnect", this.id, reasonStr, code);

    // Attempt reconnection for non-intentional disconnects
    if (code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit(
        "error",
        this.id,
        new Error(
          `Max reconnection attempts (${this.maxReconnectAttempts}) reached`
        )
      );
    }
  }

  private onError(error: Error): void {
    this.emit("error", this.id, error);
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (!this.clientId) {
      this.emit(
        "error",
        this.id,
        new Error("Cannot reconnect: clientId not available")
      );
      return;
    }

    this.connectionState = ConnectionState.RECONNECTING;
    this.reconnectAttempts++;

    // Exponential backoff with jitter
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1) +
        Math.random() * 1000,
      30000 // Max 30 seconds
    );

    this.emit("reconnect", this.id, this.reconnectAttempts, delay);

    this.reconnectTimeout = setTimeout(() => {
      if (this.connectionState === ConnectionState.RECONNECTING) {
        this.connect(this.clientId!);
      }
    }, delay);
  }
}
