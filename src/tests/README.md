# Testing utilities

This directory contains Vitest suites that exercise the Lavalink integration without
touching a real server. The tests rely on a couple of shared conventions:

- **WebSocket mock** – `Node.test.ts` replaces the `ws` dependency with an
  `EventEmitter`-driven stub. The stub stores every instantiated socket in an
  array so tests can drive lifecycle events (`open`, `message`, `close`) and
  inspect reconnection attempts. When authoring new suites that interact with
  the Lavalink gateway, reuse the pattern of capturing each constructed socket
  in an array so the test can simulate server behaviour.
- **Fetch mock** – the suites override `globalThis.fetch` with a `vi.fn()` mock
  that returns `Response` objects. This allows tests to simulate Lavalink REST
  responses (including timeouts and error payloads). If you need specialised
  payloads, call `mockResolvedValueOnce` on the mocked fetch before triggering
  the code that performs the request.
- **Deterministic node fixtures** – `Rias.test.ts` replaces the `Node` class
  with a light-weight `EventEmitter` implementation. Newly constructed nodes
  are automatically marked as connected/ready and seeded with predictable
  `NodeStats`. When extending these tests, mutate the `stats`, `connected`, or
  `isReady` fields directly on the instances returned by `rias.nodes` to model
  different cluster states.

Following these conventions keeps the Lavalink-facing logic hermetic and avoids
needing a running Lavalink instance for unit tests.
