import { EventEmitter } from "events";
import { vi } from "vitest";

export interface MockSocket extends EventEmitter {
  readyState: number;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  url: string;
  options: unknown;
}

export const __mockSockets: MockSocket[] = [];

class MockWebSocket extends EventEmitter implements MockSocket {
  public static OPEN = 1;
  public static CLOSED = 3;

  public readyState = MockWebSocket.OPEN;
  public send = vi.fn();
  public close = vi.fn((code = 1000, reason = "mock close") => {
    this.readyState = MockWebSocket.CLOSED;
    this.emit("close", code, Buffer.from(reason));
  });

  constructor(
    public url: string,
    public options: unknown
  ) {
    super();
    __mockSockets.push(this);
  }
}

export const resetMockSockets = () => {
  __mockSockets.length = 0;
};

export default MockWebSocket;
