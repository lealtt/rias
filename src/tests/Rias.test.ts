import { EventEmitter } from "events";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Client } from "discord.js";
import {
  NodeSelectionStrategy,
  type NodeStats,
  RiasErrorCode,
} from "../types/index.js";

interface MockNode extends EventEmitter {
  id: string;
  region?: string;
  priority: number;
  stats: NodeStats;
  connected: boolean;
  isReady: boolean;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

const defaultStats = (): NodeStats => ({
  players: 0,
  playingPlayers: 0,
  uptime: 0,
  memory: { free: 0, used: 0, allocated: 0, reservable: 0 },
  cpu: { cores: 1, systemLoad: 0, lavalinkLoad: 0 },
  frameStats: null,
});

vi.mock("../Node", () => {
  return {
    Node: class extends EventEmitter {
      public id: string;
      public region?: string;
      public priority: number;
      public stats: NodeStats;
      public connected = true;
      public isReady = true;
      public connect = vi.fn();
      public disconnect = vi.fn();
      public send = vi.fn();

      constructor(options: { id: string; region?: string; priority?: number }) {
        super();
        this.id = options.id;
        this.region = options.region;
        this.priority = options.priority ?? 0;
        this.stats = defaultStats();
      }
    },
  };
});

type PrivateRias = {
  getOptimalNode(region?: string): MockNode | null;
  nodes: Map<string, MockNode>;
  create(guildId: string, region?: string): unknown;
  on(event: string, listener: (...args: unknown[]) => void): void;
};

let RiasCtor: new (
  client: Client,
  options: ConstructorParameters<(typeof import("../Rias"))["Rias"]>[1]
) => PrivateRias;

beforeAll(async () => {
  const module = await import("../Rias.js");
  RiasCtor = module.Rias as unknown as typeof RiasCtor;
});

interface MockClient extends EventEmitter {
  user: { id: string };
}

const createClient = (): Client => {
  const client = new EventEmitter() as MockClient;
  client.user = { id: "client-id" };
  return client as Client;
};

const createRias = (strategy: NodeSelectionStrategy) => {
  const client = createClient();
  const send = vi.fn();
  const rias = new RiasCtor(client, {
    send,
    nodes: [
      {
        id: "node-a",
        host: "localhost",
        port: 2333,
        password: "pass",
        region: "us",
        priority: 2,
      },
      {
        id: "node-b",
        host: "localhost",
        port: 2334,
        password: "pass",
        region: "eu",
        priority: 0,
      },
      {
        id: "node-c",
        host: "localhost",
        port: 2335,
        password: "pass",
        region: "us",
        priority: 3,
      },
    ],
    nodeSelectionStrategy: strategy,
  });

  let playerCount = 0;
  for (const node of rias.nodes.values()) {
    node.connected = true;
    node.isReady = true;
    node.stats = {
      ...defaultStats(),
      players: playerCount++,
    };
  }

  return { rias, send };
};

describe("Rias node selection strategies", () => {
  it("prefers nodes with the lowest combined load when load balanced", () => {
    const { rias } = createRias(NodeSelectionStrategy.LoadBalanced);
    const nodes = Array.from(rias.nodes.values());

    nodes[0].stats = {
      ...defaultStats(),
      players: 2,
      cpu: { cores: 1, systemLoad: 0.4, lavalinkLoad: 0.5 },
    };
    nodes[1].stats = {
      ...defaultStats(),
      players: 5,
      cpu: { cores: 1, systemLoad: 0.2, lavalinkLoad: 0.2 },
    };
    nodes[2].stats = {
      ...defaultStats(),
      players: 1,
      cpu: { cores: 1, systemLoad: 0.1, lavalinkLoad: 0.7 },
    };

    const optimal = (rias as PrivateRias).getOptimalNode();
    expect(optimal?.id).toBe(nodes[1].id);
  });

  it("selects nodes matching the requested region when using regional strategy", () => {
    const { rias } = createRias(NodeSelectionStrategy.Regional);
    const nodes = Array.from(rias.nodes.values());

    nodes[0].region = "us";
    nodes[1].region = "eu";
    nodes[2].region = "us";

    const optimal = (rias as PrivateRias).getOptimalNode("eu");
    expect(optimal?.id).toBe("node-b");
  });

  it("falls back to load balancing when region is missing", () => {
    const { rias } = createRias(NodeSelectionStrategy.Regional);
    const nodes = Array.from(rias.nodes.values());

    nodes[0].stats.players = 4;
    nodes[1].stats.players = 1;
    nodes[2].stats.players = 2;
    nodes[0].stats.cpu.lavalinkLoad = 0.4;
    nodes[1].stats.cpu.lavalinkLoad = 0.1;
    nodes[2].stats.cpu.lavalinkLoad = 0.2;

    const optimal = (rias as PrivateRias).getOptimalNode("ap-south");
    expect(optimal?.id).toBe("node-b");
  });

  it("chooses the node with the fewest players for least-players strategy", () => {
    const { rias } = createRias(NodeSelectionStrategy.LeastPlayers);
    const nodes = Array.from(rias.nodes.values());

    nodes[0].stats.players = 5;
    nodes[1].stats.players = 1;
    nodes[2].stats.players = 3;

    const optimal = (rias as PrivateRias).getOptimalNode();
    expect(optimal?.id).toBe("node-b");
  });

  it("chooses the node with the lowest CPU load for least-load strategy", () => {
    const { rias } = createRias(NodeSelectionStrategy.LeastLoad);
    const nodes = Array.from(rias.nodes.values());

    nodes[0].stats.cpu.lavalinkLoad = 0.3;
    nodes[1].stats.cpu.lavalinkLoad = 0.8;
    nodes[2].stats.cpu.lavalinkLoad = 0.1;

    const optimal = (rias as PrivateRias).getOptimalNode();
    expect(optimal?.id).toBe("node-c");
  });

  it("uses the lowest priority value when priority strategy is configured", () => {
    const { rias } = createRias(NodeSelectionStrategy.Priority);
    const optimal = (rias as PrivateRias).getOptimalNode();
    expect(optimal?.id).toBe("node-b");
  });
});

describe("Rias error propagation", () => {
  it("throws a RiasError when no nodes are available", () => {
    const { rias } = createRias(NodeSelectionStrategy.LoadBalanced);
    for (const node of rias.nodes.values()) {
      node.connected = false;
      node.isReady = false;
    }

    let caught: { code?: RiasErrorCode } | null = null;
    try {
      (rias as PrivateRias).create("12345678901234567");
    } catch (error) {
      caught = error as { code?: RiasErrorCode };
    }

    expect(caught?.code).toBe(RiasErrorCode.NO_AVAILABLE_NODES);
  });

  it("re-emits node errors", () => {
    const { rias } = createRias(NodeSelectionStrategy.LoadBalanced);
    const errorSpy = vi.fn();
    rias.on("error", errorSpy);

    const node = rias.nodes.get("node-a");
    node?.emit("error", "node-a", new Error("boom"));

    expect(errorSpy).toHaveBeenCalledWith("node-a", expect.any(Error));
  });
});
