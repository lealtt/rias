import type { Track } from "./types/index.js";

/**
 * Loop modes for the queue
 */
export enum LoopMode {
  /** No looping */
  None = "none",
  /** Loop current track */
  Track = "track",
  /** Loop entire queue */
  Queue = "queue",
}

/**
 * Queue management for player tracks with advanced features
 */
export class Queue {
  private tracks: Track[] = [];
  public current: Track | null = null;
  public previous: Track | null = null;
  public loopMode: LoopMode = LoopMode.None;

  /**
   * Add a track to the queue
   */
  public add(track: Track): void {
    this.tracks.push(track);
  }

  /**
   * Add multiple tracks to the queue
   */
  public addMany(tracks: Track[]): void {
    this.tracks.push(...tracks);
  }

  /**
   * Insert a track at a specific position
   */
  public insert(index: number, track: Track): boolean {
    if (index < 0 || index > this.tracks.length) {
      return false;
    }
    this.tracks.splice(index, 0, track);
    return true;
  }

  /**
   * Remove a track at a specific index
   */
  public remove(index: number): Track | undefined {
    if (index < 0 || index >= this.tracks.length) {
      return undefined;
    }
    return this.tracks.splice(index, 1)[0];
  }

  /**
   * Get the next track without removing it
   */
  public peek(): Track | null {
    if (this.loopMode === LoopMode.Track && this.current) {
      return this.current;
    }
    return this.tracks[0] ?? null;
  }

  /**
   * Get and remove the next track (respecting loop mode)
   */
  public poll(): Track | null {
    // Handle track loop
    if (this.loopMode === LoopMode.Track && this.current) {
      return this.current;
    }

    this.previous = this.current;
    this.current = this.tracks.shift() ?? null;

    // Handle queue loop
    if (this.loopMode === LoopMode.Queue && this.current && this.previous) {
      this.tracks.push(this.previous);
    }

    return this.current;
  }

  /**
   * Clear the entire queue
   */
  public clear(): void {
    this.tracks = [];
  }

  /**
   * Shuffle the queue using Fisher-Yates algorithm
   */
  public shuffle(): void {
    for (let i = this.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
    }
  }

  /**
   * Smart shuffle - avoids consecutive tracks from same artist
   */
  public smartShuffle(): void {
    if (this.tracks.length <= 1) {
      return;
    }

    interface ArtistBucket {
      key: string;
      tracks: Track[];
    }

    const artistGroups = new Map<string, Track[]>();
    for (const track of this.tracks) {
      const artistKey = track.info.author.trim().toLowerCase();
      if (!artistGroups.has(artistKey)) {
        artistGroups.set(artistKey, []);
      }
      artistGroups.get(artistKey)!.push(track);
    }

    const buckets: ArtistBucket[] = [];
    for (const [key, tracks] of artistGroups) {
      // Shuffle each artist's collection to preserve randomness within the group
      for (let i = tracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
      }
      buckets.push({ key, tracks });
    }

    const heap: ArtistBucket[] = [];
    const pushHeap = (bucket: ArtistBucket): void => {
      heap.push(bucket);
      let index = heap.length - 1;
      while (index > 0) {
        const parent = Math.floor((index - 1) / 2);
        if (heap[parent].tracks.length >= heap[index].tracks.length) {
          break;
        }
        [heap[parent], heap[index]] = [heap[index], heap[parent]];
        index = parent;
      }
    };
    const popHeap = (): ArtistBucket | undefined => {
      if (heap.length === 0) {
        return undefined;
      }
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length > 0) {
        heap[0] = last;
        let index = 0;
        while (true) {
          let largest = index;
          const left = 2 * index + 1;
          const right = 2 * index + 2;

          if (
            left < heap.length &&
            heap[left].tracks.length > heap[largest].tracks.length
          ) {
            largest = left;
          }
          if (
            right < heap.length &&
            heap[right].tracks.length > heap[largest].tracks.length
          ) {
            largest = right;
          }
          if (largest === index) {
            break;
          }
          [heap[index], heap[largest]] = [heap[largest], heap[index]];
          index = largest;
        }
      }
      return top;
    };

    buckets.forEach((bucket) => pushHeap(bucket));

    const shuffled: Track[] = [];
    let lastArtistKey: string | null = null;

    while (heap.length > 0) {
      let bucket = popHeap()!;
      if (bucket.key === lastArtistKey) {
        const alternate = popHeap();
        if (alternate) {
          pushHeap(bucket);
          bucket = alternate;
        }
      }

      const nextTrack = bucket.tracks.shift();
      if (!nextTrack) {
        continue;
      }
      shuffled.push(nextTrack);
      lastArtistKey = bucket.key;

      if (bucket.tracks.length > 0) {
        pushHeap(bucket);
      }
    }

    this.tracks = shuffled;
  }

  /**
   * Get queue size
   */
  public get size(): number {
    return this.tracks.length;
  }

  /**
   * Check if queue is empty
   */
  public get isEmpty(): boolean {
    return this.tracks.length === 0;
  }

  /**
   * Get all tracks in the queue (read-only copy)
   */
  public get all(): readonly Track[] {
    return [...this.tracks];
  }

  /**
   * Get the total duration of all tracks in milliseconds
   */
  public get duration(): number {
    return this.tracks.reduce((acc, track) => acc + track.info.length, 0);
  }

  /**
   * Get the total duration including current track
   */
  public get totalDuration(): number {
    let total = this.duration;
    if (this.current && !this.current.info.isStream) {
      total += this.current.info.length;
    }
    return total;
  }

  /**
   * Skip to a specific position in the queue
   */
  public skipTo(index: number): Track | null {
    if (index < 0 || index >= this.tracks.length) {
      return null;
    }

    // Remove all tracks before the target
    this.tracks.splice(0, index);
    return this.poll();
  }

  /**
   * Get a track at a specific index
   */
  public at(index: number): Track | undefined {
    return this.tracks[index];
  }

  /**
   * Move a track from one position to another
   */
  public move(from: number, to: number): boolean {
    if (
      from < 0 ||
      from >= this.tracks.length ||
      to < 0 ||
      to >= this.tracks.length
    ) {
      return false;
    }

    const track = this.tracks.splice(from, 1)[0];
    this.tracks.splice(to, 0, track);
    return true;
  }

  /**
   * Swap two tracks in the queue
   */
  public swap(index1: number, index2: number): boolean {
    if (
      index1 < 0 ||
      index1 >= this.tracks.length ||
      index2 < 0 ||
      index2 >= this.tracks.length
    ) {
      return false;
    }

    [this.tracks[index1], this.tracks[index2]] = [
      this.tracks[index2],
      this.tracks[index1],
    ];
    return true;
  }

  /**
   * Find tracks by predicate
   */
  public find(predicate: (track: Track) => boolean): Track | undefined {
    return this.tracks.find(predicate);
  }

  /**
   * Filter tracks by predicate
   */
  public filter(predicate: (track: Track) => boolean): Track[] {
    return this.tracks.filter(predicate);
  }

  /**
   * Find track index by predicate
   */
  public findIndex(predicate: (track: Track) => boolean): number {
    return this.tracks.findIndex(predicate);
  }

  /**
   * Remove duplicate tracks based on identifier
   */
  public removeDuplicates(): number {
    const seen = new Set<string>();
    const original = this.tracks.length;

    this.tracks = this.tracks.filter((track) => {
      if (seen.has(track.info.identifier)) {
        return false;
      }
      seen.add(track.info.identifier);
      return true;
    });

    return original - this.tracks.length;
  }

  /**
   * Filter tracks by author
   */
  public filterByAuthor(author: string): Track[] {
    const authorLower = author.toLowerCase();
    return this.tracks.filter((t) =>
      t.info.author.toLowerCase().includes(authorLower)
    );
  }

  /**
   * Filter tracks by duration range
   */
  public filterByDuration(minMs: number, maxMs: number): Track[] {
    return this.tracks.filter(
      (t) =>
        !t.info.isStream && t.info.length >= minMs && t.info.length <= maxMs
    );
  }

  /**
   * Filter tracks by source
   */
  public filterBySource(sourceName: string): Track[] {
    const sourceLower = sourceName.toLowerCase();
    return this.tracks.filter(
      (t) => t.info.sourceName.toLowerCase() === sourceLower
    );
  }

  /**
   * Remove all tracks by a specific author
   */
  public removeByAuthor(author: string): number {
    const authorLower = author.toLowerCase();
    const original = this.tracks.length;
    this.tracks = this.tracks.filter(
      (t) => !t.info.author.toLowerCase().includes(authorLower)
    );
    return original - this.tracks.length;
  }

  /**
   * Get tracks in a specific range
   */
  public slice(start: number, end?: number): Track[] {
    return this.tracks.slice(start, end);
  }

  /**
   * Reverse the queue order
   */
  public reverse(): void {
    this.tracks.reverse();
  }

  /**
   * Set loop mode
   */
  public setLoopMode(mode: LoopMode): void {
    this.loopMode = mode;
  }

  /**
   * Toggle loop mode between none and queue
   */
  public toggleLoop(): LoopMode {
    this.loopMode =
      this.loopMode === LoopMode.None ? LoopMode.Queue : LoopMode.None;
    return this.loopMode;
  }

  /**
   * Get a summary of the queue
   */
  public getSummary(): QueueSummary {
    const authors = new Set(this.tracks.map((t) => t.info.author));
    const sources = new Set(this.tracks.map((t) => t.info.sourceName));

    return {
      size: this.size,
      duration: this.duration,
      totalDuration: this.totalDuration,
      isEmpty: this.isEmpty,
      current: this.current,
      previous: this.previous,
      loopMode: this.loopMode,
      uniqueAuthors: authors.size,
      uniqueSources: sources.size,
    };
  }

  /**
   * Clone the queue
   */
  public clone(): Queue {
    const cloned = new Queue();
    cloned.tracks = [...this.tracks];
    cloned.current = this.current;
    cloned.previous = this.previous;
    cloned.loopMode = this.loopMode;
    return cloned;
  }
}

/**
 * Queue summary interface
 */
export interface QueueSummary {
  size: number;
  duration: number;
  totalDuration: number;
  isEmpty: boolean;
  current: Track | null;
  previous: Track | null;
  loopMode: LoopMode;
  uniqueAuthors: number;
  uniqueSources: number;
}
