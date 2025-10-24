import { EventEmitter } from "events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Player } from "../Player.js";
import type { Node } from "../Node.js";
import type { RiasError } from "../types/index.js";
import { RiasErrorCode } from "../types/index.js";

class MockNode extends EventEmitter {
  public id = "mock-node";
  public isReady = true;
  public updatePlayer = vi.fn();
}

describe("Player.connect", () => {
  let node: MockNode;
  let player: Player;

  beforeEach(() => {
    vi.restoreAllMocks();
    node = new MockNode();
    player = new Player("12345678901234567", node as unknown as Node);
  });

  it("throws a RiasError with INVALID_CHANNEL when channel ID is invalid", () => {
    const emitSpy = vi.spyOn(node, "emit");
    let capturedError: RiasError | null = null;

    try {
      player.connect("not-a-channel-id");
    } catch (error) {
      capturedError = error as RiasError;
    }

    expect(capturedError).not.toBeNull();
    expect(capturedError?.code).toBe(RiasErrorCode.INVALID_CHANNEL);
    expect(capturedError?.message).toContain("Invalid channel ID");
    expect(emitSpy).not.toHaveBeenCalledWith("voiceUpdate", expect.anything());
  });

  it("emits a voiceUpdate payload when the channel ID is valid", () => {
    const emitSpy = vi.spyOn(node, "emit");
    const validChannelId = "123456789012345678";

    player.connect(validChannelId, { mute: true, deaf: false });

    expect(player.voiceChannel).toBe(validChannelId);
    expect(emitSpy).toHaveBeenCalledWith("voiceUpdate", {
      guild_id: player.guildId,
      channel_id: validChannelId,
      self_mute: true,
      self_deaf: false,
    });
  });
});
