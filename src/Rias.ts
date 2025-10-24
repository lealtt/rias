import { EventEmitter } from "events";
import type { Client } from "discord.js";
import { Node } from "./Node.js";
import { Player } from "./Player.js";
import type {
  RiasOptions,
  NodeOptions,
  NodeEvents,
  VoiceServerUpdate,
  VoiceStateUpdate,
  LoadTracksResponse,
  SearchSource,
  RiasErrorCode,
  RiasError,
  NodeStats,
  LavalinkInfo,
  PluginInfo,
} from "./types/index.js";
import { NodeSelectionStrategy } from "./types/index.js";
import { ValidationUtils } from "./utils/validation.js";

/**
 * Main Rias client for managing Lavalink connections and players
 */
export class Rias extends EventEmitter<NodeEvents> {
  public readonly nodes = new Map<string, Node>();
  public readonly players = new Map<string, Player>();

  private readonly clientId: string;
  private readonly send: (
    guildId: string,
    payload: Record<string, unknown>
  ) => void;
  private readonly defaultSearchSource?: SearchSource;
  private readonly nodeSelectionStrategy: NodeSelectionStrategy;
  private readonly userAgent: string;
  private readonly debug: boolean;
  private initiated = false;
  private shuttingDown = false;

  constructor(
    private client: Client,
    options: RiasOptions
  ) {
    super();

    if (!client.user) {
      throw new Error("Discord client must be ready before initializing Rias");
    }

    this.clientId = client.user.id;
    this.send = options.send;
    this.defaultSearchSource = options.defaultSearchSource;
    this.nodeSelectionStrategy =
      options.nodeSelectionStrategy ?? NodeSelectionStrategy.LoadBalanced;
    this.userAgent = options.userAgent ?? "Rias";
    this.debug = options.debug ?? false;

    // Validate nodes
    if (!options.nodes || options.nodes.length === 0) {
      throw new Error("At least one node is required");
    }

    // Initialize nodes
    for (const nodeOptions of options.nodes) {
      this.validateNodeOptions(nodeOptions);
      const node = new Node(nodeOptions, this.userAgent);
      this.setupNodeListeners(node);
      this.nodes.set(nodeOptions.id, node);
    }

    // Set up Discord event listeners
    this.setupDiscordListeners();

    if (this.debug) {
      this.enableDebugMode();
    }
  }

  /**
   * Initialize Rias and connect to all nodes
   */
  public init(): void {
    if (this.initiated) {
      throw new Error("Rias has already been initiated");
    }

    if (this.debug) {
      console.log("[Rias Debug] Initializing Rias...");
      console.log(`[Rias Debug] Client ID: ${this.clientId}`);
      console.log(`[Rias Debug] Nodes: ${this.nodes.size}`);
    }

    for (const node of this.nodes.values()) {
      try {
        node.connect(this.clientId);
        if (this.debug) {
          console.log(`[Rias Debug] Connecting to node: ${node.id}`);
        }
      } catch (error) {
        console.error(`Failed to connect to node ${node.id}:`, error);
        this.emit("error", node.id, error as Error);
      }
    }

    this.initiated = true;
  }

  /**
   * Create or get a player for a guild
   */
  public create(guildId: string, region?: string): Player {
    if (this.shuttingDown) {
      throw this.createError(
        "NODE_NOT_READY" as RiasErrorCode,
        "Rias is shutting down"
      );
    }

    if (!ValidationUtils.isValidGuildId(guildId)) {
      throw this.createError(
        "PLAYER_NOT_FOUND" as RiasErrorCode,
        "Invalid guild ID"
      );
    }

    let player = this.players.get(guildId);

    if (!player) {
      const node = this.getOptimalNode(region);
      if (!node) {
        throw this.createError(
          "NO_AVAILABLE_NODES" as RiasErrorCode,
          "No available nodes. Please ensure at least one node is connected."
        );
      }

      player = new Player(guildId, node);
      this.players.set(guildId, player);

      if (this.debug) {
        console.log(
          `[Rias Debug] Created player for guild ${guildId} on node ${node.id}`
        );
      }

      // Clean up player when destroyed
      player.once("destroy", () => {
        this.players.delete(guildId);
        if (this.debug) {
          console.log(`[Rias Debug] Player destroyed for guild ${guildId}`);
        }
      });

      // Forward player errors
      player.on("error", (error) => {
        this.emit("playerError", guildId, error);
      });
    }

    return player;
  }

  /**
   * Get a player for a guild
   */
  public get(guildId: string): Player | undefined {
    return this.players.get(guildId);
  }

  /**
   * Destroy a player
   */
  public async destroy(guildId: string): Promise<boolean> {
    const player = this.players.get(guildId);
    if (!player) return false;

    try {
      await player.destroy();
      this.players.delete(guildId);
      return true;
    } catch (error) {
      this.emit("error", guildId, error as Error);
      return false;
    }
  }

  /**
   * Destroy all players
   */
  public async destroyAll(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const player of this.players.values()) {
      promises.push(
        player.destroy().catch((err) => {
          console.error(`Error destroying player ${player.guildId}:`, err);
        })
      );
    }

    await Promise.allSettled(promises);
    this.players.clear();
  }

  /**
   * Search for tracks
   */
  public async search(
    query: string,
    source?: SearchSource
  ): Promise<LoadTracksResponse> {
    const node = this.getOptimalNode();
    if (!node) {
      throw this.createError(
        "NO_AVAILABLE_NODES" as RiasErrorCode,
        "No available nodes"
      );
    }

    // Sanitize query
    const sanitized = ValidationUtils.sanitizeSearchQuery(query);

    // Use provided source, default source, or auto-detect
    const searchSource = source ?? this.defaultSearchSource;
    const identifier = searchSource
      ? `${searchSource}:${sanitized}`
      : ValidationUtils.isValidUrl(sanitized)
        ? sanitized
        : `ytsearch:${sanitized}`;

    if (this.debug) {
      console.log(`[Rias Debug] Searching: ${identifier}`);
    }

    return node.loadTracks(identifier);
  }

  /**
   * Load tracks from a URL or search query
   */
  public async load(identifier: string): Promise<LoadTracksResponse> {
    const node = this.getOptimalNode();
    if (!node) {
      throw this.createError(
        "NO_AVAILABLE_NODES" as RiasErrorCode,
        "No available nodes"
      );
    }

    if (this.debug) {
      console.log(`[Rias Debug] Loading: ${identifier}`);
    }

    return node.loadTracks(identifier);
  }

  /**
   * Decode a track
   */
  public async decodeTrack(
    encoded: string
  ): Promise<import("./types/index.js").DecodedTrack> {
    const node = this.getOptimalNode();
    if (!node) {
      throw this.createError(
        "NO_AVAILABLE_NODES" as RiasErrorCode,
        "No available nodes"
      );
    }

    return node.decodeTrack(encoded);
  }

  /**
   * Decode multiple tracks
   */
  public async decodeTracks(
    encoded: string[]
  ): Promise<import("./types/index.js").DecodedTrack[]> {
    const node = this.getOptimalNode();
    if (!node) {
      throw this.createError(
        "NO_AVAILABLE_NODES" as RiasErrorCode,
        "No available nodes"
      );
    }

    return node.decodeTracks(encoded);
  }

  /**
   * Get all connected nodes
   */
  public getConnectedNodes(): Node[] {
    return Array.from(this.nodes.values()).filter((n) => n.connected);
  }

  /**
   * Get node by ID
   */
  public getNode(nodeId: string): Node | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Get statistics for all nodes
   */
  public getStats(): Map<string, NodeStats> {
    const stats = new Map<string, NodeStats>();
    for (const [id, node] of this.nodes) {
      stats.set(id, node.stats);
    }
    return stats;
  }

  /**
   * Get Lavalink server information from all nodes
   * @param forceRefresh - Force refresh the cache
   */
  public async getInfo(
    forceRefresh = false
  ): Promise<Map<string, LavalinkInfo>> {
    const infos = new Map<string, LavalinkInfo>();
    const promises: Promise<void>[] = [];

    for (const [id, node] of this.nodes) {
      if (!node.connected) continue;

      promises.push(
        node
          .getInfo(forceRefresh)
          .then((info) => {
            infos.set(id, info);
          })
          .catch((error) => {
            if (this.debug) {
              console.error(
                `[Rias Debug] Failed to get info from node ${id}:`,
                error
              );
            }
          })
      );
    }

    await Promise.allSettled(promises);
    return infos;
  }

  /**
   * Get all plugins installed across all nodes
   * Returns a map of node ID to plugin list
   * @param forceRefresh - Force refresh the cache
   */
  public async getAllPlugins(
    forceRefresh = false
  ): Promise<Map<string, PluginInfo[]>> {
    const pluginsMap = new Map<string, PluginInfo[]>();
    const promises: Promise<void>[] = [];

    for (const [id, node] of this.nodes) {
      if (!node.connected) continue;

      promises.push(
        node
          .getPlugins(forceRefresh)
          .then((plugins) => {
            pluginsMap.set(id, plugins);
          })
          .catch((error) => {
            if (this.debug) {
              console.error(
                `[Rias Debug] Failed to get plugins from node ${id}:`,
                error
              );
            }
          })
      );
    }

    await Promise.allSettled(promises);
    return pluginsMap;
  }

  /**
   * Get unique plugins across all nodes
   * Returns a list of unique plugins (by name)
   * @param forceRefresh - Force refresh the cache
   */
  public async getUniquePlugins(forceRefresh = false): Promise<PluginInfo[]> {
    const pluginsMap = await this.getAllPlugins(forceRefresh);
    const uniquePlugins = new Map<string, PluginInfo>();

    for (const plugins of pluginsMap.values()) {
      for (const plugin of plugins) {
        if (!uniquePlugins.has(plugin.name)) {
          uniquePlugins.set(plugin.name, plugin);
        }
      }
    }

    return Array.from(uniquePlugins.values());
  }

  /**
   * Check if a plugin is available on any node
   * @param pluginName - The plugin name to check
   * @param forceRefresh - Force refresh the cache
   */
  public async hasPlugin(
    pluginName: string,
    forceRefresh = false
  ): Promise<boolean> {
    const promises: Promise<boolean>[] = [];

    for (const node of this.nodes.values()) {
      if (!node.connected) continue;
      promises.push(node.hasPlugin(pluginName, forceRefresh));
    }

    const results = await Promise.allSettled(promises);
    return results.some(
      (result) => result.status === "fulfilled" && result.value === true
    );
  }

  /**
   * Get all nodes that have a specific plugin installed
   * @param pluginName - The plugin name to search for
   * @param forceRefresh - Force refresh the cache
   */
  public async getNodesWithPlugin(
    pluginName: string,
    forceRefresh = false
  ): Promise<Node[]> {
    const nodesWithPlugin: Node[] = [];
    const promises: Promise<{ node: Node; hasPlugin: boolean }>[] = [];

    for (const node of this.nodes.values()) {
      if (!node.connected) continue;

      promises.push(
        node
          .hasPlugin(pluginName, forceRefresh)
          .then((hasPlugin) => ({ node, hasPlugin }))
          .catch(() => ({ node, hasPlugin: false }))
      );
    }

    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.hasPlugin) {
        nodesWithPlugin.push(result.value.node);
      }
    }

    return nodesWithPlugin;
  }

  /**
   * Make a plugin request to the optimal node
   * @param pluginName - The plugin name
   * @param endpoint - The endpoint path
   * @param options - Fetch options
   */
  public async pluginRequest<T = unknown>(
    pluginName: string,
    endpoint: string,
    options?: Omit<RequestInit, "headers"> & {
      headers?: Record<string, string>;
    }
  ): Promise<T> {
    // Find a node with the plugin
    const nodesWithPlugin = await this.getNodesWithPlugin(pluginName);

    if (nodesWithPlugin.length === 0) {
      throw this.createError(
        "REST_ERROR" as RiasErrorCode,
        `Plugin "${pluginName}" is not installed on any connected node`
      );
    }

    // Use the optimal node among those with the plugin
    const node = this.selectLoadBalancedNode(nodesWithPlugin);

    return node.pluginRequest<T>(pluginName, endpoint, options);
  }

  /**
   * Gracefully shutdown Rias
   */
  public async shutdown(timeout = 30000): Promise<void> {
    if (this.shuttingDown) {
      return;
    }

    this.shuttingDown = true;
    console.log("[Rias] Shutting down...");

    try {
      // Stop all players with timeout
      await Promise.race([
        this.destroyAll(),
        new Promise((resolve) => setTimeout(resolve, timeout)),
      ]);

      // Disconnect all nodes
      for (const node of this.nodes.values()) {
        node.disconnect();
      }

      console.log("[Rias] Shutdown complete");
    } catch (error) {
      console.error("[Rias] Error during shutdown:", error);
    }
  }

  /**
   * Get the optimal node based on configured strategy and optional region
   */
  private getOptimalNode(region?: string): Node | null {
    const nodes = Array.from(this.nodes.values()).filter(
      (n) => n.connected && n.isReady
    );

    if (nodes.length === 0) return null;
    if (nodes.length === 1) return nodes[0];

    // Apply node selection strategy
    switch (this.nodeSelectionStrategy) {
      case NodeSelectionStrategy.Regional:
        return this.selectRegionalNode(nodes, region);

      case NodeSelectionStrategy.LeastPlayers:
        return this.selectLeastPlayersNode(nodes);

      case NodeSelectionStrategy.LeastLoad:
        return this.selectLeastLoadNode(nodes);

      case NodeSelectionStrategy.Priority:
        return this.selectPriorityNode(nodes);

      case NodeSelectionStrategy.LoadBalanced:
      default:
        return this.selectLoadBalancedNode(nodes);
    }
  }

  /**
   * Select node based on region, falling back to load-balanced if no match
   */
  private selectRegionalNode(nodes: Node[], region?: string): Node {
    if (!region) {
      return this.selectLoadBalancedNode(nodes);
    }

    // Filter nodes by region
    const regionalNodes = nodes.filter((n) => n.region === region);

    if (regionalNodes.length === 0) {
      if (this.debug) {
        console.log(
          `[Rias Debug] No nodes found in region "${region}", using load-balanced selection`
        );
      }
      return this.selectLoadBalancedNode(nodes);
    }

    // Use load balancing among regional nodes
    return this.selectLoadBalancedNode(regionalNodes);
  }

  /**
   * Select node with lowest player count
   */
  private selectLeastPlayersNode(nodes: Node[]): Node {
    return nodes.sort((a, b) => a.stats.players - b.stats.players)[0];
  }

  /**
   * Select node with lowest CPU load
   */
  private selectLeastLoadNode(nodes: Node[]): Node {
    return nodes.sort(
      (a, b) => a.stats.cpu.lavalinkLoad - b.stats.cpu.lavalinkLoad
    )[0];
  }

  /**
   * Select node based on priority (lower = higher priority)
   */
  private selectPriorityNode(nodes: Node[]): Node {
    return nodes.sort((a, b) => a.priority - b.priority)[0];
  }

  /**
   * Select node based on combined load (CPU and player count)
   */
  private selectLoadBalancedNode(nodes: Node[]): Node {
    return nodes.sort((a, b) => {
      const aLoad = a.stats.cpu.lavalinkLoad * (1 + a.stats.players * 0.1);
      const bLoad = b.stats.cpu.lavalinkLoad * (1 + b.stats.players * 0.1);
      return aLoad - bLoad;
    })[0];
  }

  /**
   * Validate node options
   */
  private validateNodeOptions(options: NodeOptions): void {
    if (!options.id || typeof options.id !== "string") {
      throw new Error("Node id is required and must be a string");
    }
    if (!options.host || typeof options.host !== "string") {
      throw new Error("Node host is required and must be a string");
    }
    if (!options.port || typeof options.port !== "number") {
      throw new Error("Node port is required and must be a number");
    }
    if (!options.password || typeof options.password !== "string") {
      throw new Error("Node password is required and must be a string");
    }
  }

  /**
   * Set up listeners for node events
   */
  private setupNodeListeners(node: Node): void {
    node.on("connect", (nodeId) => {
      if (this.debug) {
        console.log(`[Rias Debug] Node ${nodeId} connected`);
      }
      this.emit("connect", nodeId);
    });

    node.on("reconnect", (nodeId, attempt, delay) => {
      if (this.debug) {
        console.log(
          `[Rias Debug] Node ${nodeId} reconnecting (attempt ${attempt}, delay ${delay}ms)`
        );
      }
      this.emit("reconnect", nodeId, attempt, delay);
    });

    node.on("disconnect", (nodeId, reason, code) => {
      if (this.debug) {
        console.log(
          `[Rias Debug] Node ${nodeId} disconnected: ${reason} (code: ${code})`
        );
      }
      this.emit("disconnect", nodeId, reason, code);
    });

    node.on("error", (nodeId, error) => {
      if (this.debug) {
        console.error(`[Rias Debug] Node ${nodeId} error:`, error);
      }
      this.emit("error", nodeId, error);
    });

    node.on("ready", (payload) => {
      if (this.debug) {
        console.log(
          `[Rias Debug] Node ${node.id} ready (session: ${payload.sessionId})`
        );
      }
      this.emit("ready", node.id, payload.sessionId);
    });

    node.on("stats", (payload) => {
      this.emit("stats", node.id, payload);
    });

    // Forward plugin events
    node.on("pluginLoaded", (nodeId, plugin) => {
      if (this.debug) {
        console.log(
          `[Rias Debug] Plugin loaded on node ${nodeId}: ${plugin.name}@${plugin.version}`
        );
      }
      this.emit("pluginLoaded", nodeId, plugin);
    });

    node.on("infoUpdate", (nodeId, info) => {
      if (this.debug) {
        console.log(
          `[Rias Debug] Server info updated for node ${nodeId}: Lavalink ${info.version.semver}, ${info.plugins.length} plugins`
        );
      }
      this.emit("infoUpdate", nodeId, info);
    });

    // Handle voice updates from players
    node.on("voiceUpdate", (payload) => {
      try {
        this.send(payload.guild_id, {
          op: 4,
          d: {
            guild_id: payload.guild_id,
            channel_id: payload.channel_id,
            self_mute: payload.self_mute,
            self_deaf: payload.self_deaf,
          },
        });
      } catch (error) {
        if (this.debug) {
          console.error("[Rias Debug] Failed to send voice update:", error);
        }
        this.emit("error", node.id, error as Error);
      }
    });
  }

  /**
   * Type guard for VoiceServerUpdate
   */
  private isVoiceServerUpdate(
    data: Record<string, unknown>
  ): data is Record<string, unknown> & VoiceServerUpdate {
    return (
      typeof data.token === "string" &&
      typeof data.guild_id === "string" &&
      (data.endpoint === null || typeof data.endpoint === "string")
    );
  }

  /**
   * Type guard for VoiceStateUpdate
   */
  private isVoiceStateUpdate(
    data: Record<string, unknown>
  ): data is Record<string, unknown> & VoiceStateUpdate {
    return (
      typeof data.guild_id === "string" &&
      typeof data.user_id === "string" &&
      typeof data.session_id === "string" &&
      (data.channel_id === null || typeof data.channel_id === "string")
    );
  }

  /**
   * Set up Discord event listeners for voice updates
   */
  private setupDiscordListeners(): void {
    this.client.on(
      "raw",
      (packet: { t?: string; d?: Record<string, unknown> }) => {
        if (
          !packet.t ||
          !["VOICE_SERVER_UPDATE", "VOICE_STATE_UPDATE"].includes(packet.t)
        ) {
          return;
        }

        if (!packet.d || typeof packet.d.guild_id !== "string") {
          return;
        }

        const player = this.players.get(packet.d.guild_id);
        if (!player) return;

        if (
          packet.t === "VOICE_SERVER_UPDATE" &&
          this.isVoiceServerUpdate(packet.d)
        ) {
          player.voiceServerUpdate(packet.d);
        } else if (
          packet.t === "VOICE_STATE_UPDATE" &&
          this.isVoiceStateUpdate(packet.d)
        ) {
          if (packet.d.user_id !== this.clientId) return;
          player.voiceStateUpdate(packet.d);
        }
      }
    );
  }

  /**
   * Enable debug mode with enhanced logging
   */
  private enableDebugMode(): void {
    console.log("[Rias Debug] Debug mode enabled");

    const originalEmit = this.emit.bind(this) as (
      event: string | symbol,
      ...args: unknown[]
    ) => boolean;
    this.emit = ((event: string | symbol, ...args: unknown[]): boolean => {
      console.log(`[Rias Debug] Event: ${String(event)}`, args);
      return originalEmit(event, ...args);
    }) as typeof this.emit;
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
