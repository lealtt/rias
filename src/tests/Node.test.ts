import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { NodeOptions, LavalinkInfo, PluginInfo } from "../types";
import type { Node } from "../Node";
import {
  __mockSockets as mockSockets,
  resetMockSockets,
} from "../../__mocks__/ws";

vi.mock("ws");

const nodeInfo: LavalinkInfo = {
  version: {
    semver: "4.0.0",
    major: 4,
    minor: 0,
    patch: 0,
    preRelease: null,
    build: null,
  },
  buildTime: 0,
  git: { branch: "main", commit: "abc123", commitTime: 0 },
  jvm: "17",
  lavaplayer: "1.0.0",
  sourceManagers: ["youtube"],
  filters: ["equalizer"],
  plugins: [
    { name: "plugin-a", version: "1.0.0" },
    { name: "plugin-b", version: "2.0.0" },
  ],
};

const createNodeOptions = (
  overrides: Partial<NodeOptions> = {}
): NodeOptions => ({
  id: "test-node",
  host: "localhost",
  port: 2333,
  password: "youshallnotpass",
  secure: false,
  ...overrides,
});

const originalFetch = globalThis.fetch;
let NodeCtor: typeof Node;

beforeAll(async () => {
  NodeCtor = (await import("../Node")).Node;
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  resetMockSockets();
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(nodeInfo), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe("Node connectivity and plugin discovery", () => {
  it("reconnects after an unexpected close and rediscovers plugins", async () => {
    const node = new NodeCtor(createNodeOptions());
    const reconnectSpy = vi.fn();
    const infoUpdateSpy = vi.fn();
    const pluginLoadedSpy = vi.fn();
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const errorSpy = vi.fn();
    const infoUpdatePromise = new Promise<LavalinkInfo>((resolve) => {
      node.once("infoUpdate", (_id, info) => resolve(info));
    });
    const pluginEvents: PluginInfo[] = [];

    node.on("reconnect", reconnectSpy);
    node.on("infoUpdate", infoUpdateSpy);
    node.on("pluginLoaded", (id, plugin) => {
      pluginLoadedSpy(id, plugin);
      pluginEvents.push(plugin);
    });
    node.on("error", errorSpy);

    node.connect("client-id");

    expect(mockSockets).toHaveLength(1);
    const socket = mockSockets[0];

    socket.emit("open");

    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();

    const info = await infoUpdatePromise;
    expect(info.plugins).toEqual(nodeInfo.plugins);
    expect(pluginLoadedSpy).toHaveBeenCalledTimes(nodeInfo.plugins.length);
    expect(pluginEvents).toEqual(nodeInfo.plugins);

    socket.emit(
      "message",
      Buffer.from(
        JSON.stringify({
          op: "ready",
          sessionId: "session-123",
          resumed: false,
        })
      )
    );

    socket.emit("close", 1011, Buffer.from("unexpected"));

    expect(reconnectSpy).toHaveBeenCalledTimes(1);
    expect(reconnectSpy).toHaveBeenCalledWith(
      "test-node",
      1,
      expect.any(Number)
    );

    await vi.runOnlyPendingTimersAsync();

    expect(mockSockets).toHaveLength(2);
    const secondSocket = mockSockets[1];

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify(nodeInfo), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    secondSocket.emit("open");

    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("Node REST player lifecycle", () => {
  const guildId = "123456789012345678";

  const emitReady = () => {
    const socket = mockSockets[mockSockets.length - 1];
    socket.emit("open");
    socket.emit(
      "message",
      Buffer.from(
        JSON.stringify({
          op: "ready",
          sessionId: "session-xyz",
          resumed: false,
        })
      )
    );
  };

  it("updates player state via REST", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(nodeInfo), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const node = new NodeCtor(createNodeOptions());
    const errorSpy = vi.fn();
    node.on("error", errorSpy);

    node.connect("client-id");
    emitReady();
    await Promise.resolve();
    await Promise.resolve();

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await node.updatePlayer(guildId, { encodedTrack: "track-id" }, true);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, requestInit] = (fetchMock.mock.calls[1] ?? []) as [
      string,
      RequestInit,
    ];
    expect(requestInit?.method).toBe("PATCH");
    expect(requestInit?.body).toBe(
      JSON.stringify({ encodedTrack: "track-id" })
    );
    expect((fetchMock.mock.calls[1]?.[0] as string) ?? "").toContain(
      `/players/${guildId}`
    );
    expect((fetchMock.mock.calls[1]?.[0] as string) ?? "").toContain(
      "noReplace=true"
    );
  });

  it("emits errors when updatePlayer fails", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(nodeInfo), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const node = new NodeCtor(createNodeOptions());
    const errorSpy = vi.fn();
    node.on("error", errorSpy);

    node.connect("client-id");
    emitReady();
    await Promise.resolve();
    await Promise.resolve();

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "boom" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(
      node.updatePlayer(guildId, { encodedTrack: "track" })
    ).rejects.toThrow("Failed to update player");

    expect(errorSpy).toHaveBeenCalled();
  });

  it("destroys players via REST and surfaces errors", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(nodeInfo), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const node = new NodeCtor(createNodeOptions());
    const errorSpy = vi.fn();
    node.on("error", errorSpy);
    node.connect("client-id");
    emitReady();
    await Promise.resolve();
    await Promise.resolve();

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await node.destroyPlayer(guildId);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "gone" }), { status: 404 })
    );
    await expect(node.destroyPlayer(guildId)).resolves.toBeUndefined();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
