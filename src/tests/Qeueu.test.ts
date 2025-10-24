import { describe, it, expect, beforeEach } from "vitest";
import { Queue, LoopMode } from "../Queue";
import type { Track } from "../types";

// Mock track factory
function createMockTrack(
  id: string,
  author = "Test Author",
  length = 180000
): Track {
  return {
    encoded: `encoded_${id}`,
    info: {
      identifier: id,
      isSeekable: true,
      author,
      length,
      isStream: false,
      position: 0,
      title: `Test Track ${id}`,
      sourceName: "youtube",
      uri: `https://example.com/${id}`,
    },
  };
}

describe("Queue", () => {
  let queue: Queue;

  beforeEach(() => {
    queue = new Queue();
  });

  describe("Basic Operations", () => {
    it("should start empty", () => {
      expect(queue.isEmpty).toBe(true);
      expect(queue.size).toBe(0);
    });

    it("should add a track", () => {
      const track = createMockTrack("1");
      queue.add(track);

      expect(queue.isEmpty).toBe(false);
      expect(queue.size).toBe(1);
    });

    it("should add multiple tracks", () => {
      const tracks = [
        createMockTrack("1"),
        createMockTrack("2"),
        createMockTrack("3"),
      ];
      queue.addMany(tracks);

      expect(queue.size).toBe(3);
    });

    it("should poll tracks in order", () => {
      const tracks = [
        createMockTrack("1"),
        createMockTrack("2"),
        createMockTrack("3"),
      ];
      queue.addMany(tracks);

      expect(queue.poll()?.info.identifier).toBe("1");
      expect(queue.poll()?.info.identifier).toBe("2");
      expect(queue.poll()?.info.identifier).toBe("3");
      expect(queue.poll()).toBeNull();
    });

    it("should peek without removing", () => {
      const track = createMockTrack("1");
      queue.add(track);

      expect(queue.peek()?.info.identifier).toBe("1");
      expect(queue.size).toBe(1);
      expect(queue.peek()?.info.identifier).toBe("1");
    });

    it("should remove track at index", () => {
      const tracks = [
        createMockTrack("1"),
        createMockTrack("2"),
        createMockTrack("3"),
      ];
      queue.addMany(tracks);

      const removed = queue.remove(1);
      expect(removed?.info.identifier).toBe("2");
      expect(queue.size).toBe(2);
    });

    it("should clear all tracks", () => {
      const tracks = [createMockTrack("1"), createMockTrack("2")];
      queue.addMany(tracks);
      queue.clear();

      expect(queue.isEmpty).toBe(true);
      expect(queue.size).toBe(0);
    });
  });

  describe("Advanced Operations", () => {
    it("should insert track at specific position", () => {
      queue.addMany([createMockTrack("1"), createMockTrack("3")]);

      queue.insert(1, createMockTrack("2"));

      expect(queue.at(0)?.info.identifier).toBe("1");
      expect(queue.at(1)?.info.identifier).toBe("2");
      expect(queue.at(2)?.info.identifier).toBe("3");
    });

    it("should move track from one position to another", () => {
      queue.addMany([
        createMockTrack("1"),
        createMockTrack("2"),
        createMockTrack("3"),
      ]);

      queue.move(2, 0);

      expect(queue.at(0)?.info.identifier).toBe("3");
      expect(queue.at(1)?.info.identifier).toBe("1");
      expect(queue.at(2)?.info.identifier).toBe("2");
    });

    it("should swap two tracks", () => {
      queue.addMany([
        createMockTrack("1"),
        createMockTrack("2"),
        createMockTrack("3"),
      ]);

      queue.swap(0, 2);

      expect(queue.at(0)?.info.identifier).toBe("3");
      expect(queue.at(2)?.info.identifier).toBe("1");
    });

    it("should shuffle tracks", () => {
      const tracks = Array.from({ length: 10 }, (_, i) =>
        createMockTrack(String(i))
      );
      queue.addMany(tracks);

      const original = queue.all.map((t) => t.info.identifier);

      // Try shuffling multiple times to ensure we get a different order
      // With 10 items, probability of same order is 1/10! = 1/3,628,800
      let shuffled: string[] = [];
      let differentOrder = false;

      for (let i = 0; i < 10 && !differentOrder; i++) {
        queue.clear();
        queue.addMany(tracks);
        queue.shuffle();
        shuffled = queue.all.map((t) => t.info.identifier);
        differentOrder = JSON.stringify(shuffled) !== JSON.stringify(original);
      }

      // Should have same tracks
      expect(shuffled.sort()).toEqual(original.sort());
      // Should eventually get a different order (virtually guaranteed after 10 tries)
      expect(differentOrder).toBe(true);
    });

    it("should skip to specific position", () => {
      queue.addMany([
        createMockTrack("1"),
        createMockTrack("2"),
        createMockTrack("3"),
        createMockTrack("4"),
      ]);

      const track = queue.skipTo(2);

      expect(track?.info.identifier).toBe("3");
      expect(queue.size).toBe(1);
    });
  });

  describe("Loop Modes", () => {
    it("should loop current track", () => {
      const track = createMockTrack("1");
      queue.add(createMockTrack("2"));
      queue.current = track;
      queue.setLoopMode(LoopMode.Track);

      expect(queue.poll()?.info.identifier).toBe("1");
      expect(queue.poll()?.info.identifier).toBe("1");
      expect(queue.current?.info.identifier).toBe("1");
    });

    it("should loop entire queue", () => {
      queue.addMany([createMockTrack("1"), createMockTrack("2")]);
      queue.setLoopMode(LoopMode.Queue);

      expect(queue.poll()?.info.identifier).toBe("1");
      expect(queue.poll()?.info.identifier).toBe("2");
      expect(queue.size).toBe(1); // Track 1 should be added back
      expect(queue.at(0)?.info.identifier).toBe("1");
    });
  });

  describe("Filtering", () => {
    beforeEach(() => {
      queue.addMany([
        createMockTrack("1", "Artist A", 120000),
        createMockTrack("2", "Artist B", 240000),
        createMockTrack("3", "Artist A", 180000),
        createMockTrack("4", "Artist C", 300000),
      ]);
    });

    it("should filter by author", () => {
      const filtered = queue.filterByAuthor("Artist A");
      expect(filtered.length).toBe(2);
      expect(filtered[0].info.identifier).toBe("1");
      expect(filtered[1].info.identifier).toBe("3");
    });

    it("should filter by duration", () => {
      const filtered = queue.filterByDuration(150000, 250000);
      expect(filtered.length).toBe(2);
    });

    it("should filter by source", () => {
      const filtered = queue.filterBySource("youtube");
      expect(filtered.length).toBe(4);
    });

    it("should remove tracks by author", () => {
      const removed = queue.removeByAuthor("Artist A");
      expect(removed).toBe(2);
      expect(queue.size).toBe(2);
    });

    it("should remove duplicates", () => {
      queue.add(createMockTrack("1")); // Duplicate
      queue.add(createMockTrack("2")); // Duplicate

      const removed = queue.removeDuplicates();
      expect(removed).toBe(2);
      expect(queue.size).toBe(4);
    });
  });

  describe("Queue Summary", () => {
    it("should provide accurate summary", () => {
      queue.addMany([
        createMockTrack("1", "Artist A", 180000),
        createMockTrack("2", "Artist B", 240000),
        createMockTrack("3", "Artist A", 120000),
      ]);
      queue.current = createMockTrack("0", "Artist C", 200000);
      queue.setLoopMode(LoopMode.Queue);

      const summary = queue.getSummary();

      expect(summary.size).toBe(3);
      expect(summary.duration).toBe(540000);
      expect(summary.totalDuration).toBe(740000);
      expect(summary.isEmpty).toBe(false);
      expect(summary.loopMode).toBe(LoopMode.Queue);
      expect(summary.uniqueAuthors).toBe(2);
      expect(summary.current?.info.identifier).toBe("0");
    });
  });

  describe("Duration Calculation", () => {
    it("should calculate total duration", () => {
      queue.addMany([
        createMockTrack("1", "Artist A", 180000),
        createMockTrack("2", "Artist B", 240000),
      ]);

      expect(queue.duration).toBe(420000);
    });

    it("should calculate total duration including current", () => {
      queue.addMany([
        createMockTrack("1", "Artist A", 180000),
        createMockTrack("2", "Artist B", 240000),
      ]);
      queue.current = createMockTrack("0", "Artist C", 200000);

      expect(queue.totalDuration).toBe(620000);
    });
  });

  describe("Smart Shuffle", () => {
    it("should avoid consecutive tracks from same artist", () => {
      queue.addMany([
        createMockTrack("1", "Artist A"),
        createMockTrack("2", "Artist A"),
        createMockTrack("3", "Artist A"),
        createMockTrack("4", "Artist B"),
        createMockTrack("5", "Artist B"),
        createMockTrack("6", "Artist C"),
      ]);

      queue.smartShuffle();

      // Check that no two consecutive tracks are from the same artist
      const tracks = queue.all;
      for (let i = 0; i < tracks.length - 1; i++) {
        expect(tracks[i].info.author).not.toBe(tracks[i + 1].info.author);
      }

      const authors = tracks.map((t) => t.info.author).sort();
      expect(authors).toEqual([
        "Artist A",
        "Artist A",
        "Artist A",
        "Artist B",
        "Artist B",
        "Artist C",
      ]);
    });

    it("should deterministically spread imbalanced artists when possible", () => {
      queue.addMany([
        createMockTrack("1", "Artist A"),
        createMockTrack("2", "Artist A"),
        createMockTrack("3", "Artist A"),
        createMockTrack("4", "Artist B"),
        createMockTrack("5", "Artist C"),
      ]);

      queue.smartShuffle();

      const tracks = queue.all;
      expect(tracks).toHaveLength(5);

      const authors = tracks.map((t) => t.info.author);
      const sortedAuthors = [...authors].sort();
      expect(sortedAuthors).toEqual([
        "Artist A",
        "Artist A",
        "Artist A",
        "Artist B",
        "Artist C",
      ]);

      for (let i = 0; i < authors.length - 1; i++) {
        expect(authors[i]).not.toBe(authors[i + 1]);
      }
    });
  });

  describe("Clone", () => {
    it("should create independent copy", () => {
      queue.addMany([createMockTrack("1"), createMockTrack("2")]);
      queue.setLoopMode(LoopMode.Queue);

      const cloned = queue.clone();

      // Modify original
      queue.add(createMockTrack("3"));
      queue.setLoopMode(LoopMode.None);

      // Clone should be unchanged
      expect(cloned.size).toBe(2);
      expect(cloned.loopMode).toBe(LoopMode.Queue);
      expect(queue.size).toBe(3);
    });
  });
});
