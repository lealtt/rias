import type {
  Track,
  EqualizerBand,
  FilterOptions,
  TimescaleOptions,
} from "../types/index.js";

/**
 * Format milliseconds to a readable time string (MM:SS or HH:MM:SS)
 */
export function formatTime(ms: number): string {
  if (ms < 0) return "00:00";

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  const secs = seconds % 60;
  const mins = minutes % 60;

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }

  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Parse a time string (MM:SS or HH:MM:SS) to milliseconds
 */
export function parseTime(time: string): number {
  const parts = time.split(":").map(Number);

  if (parts.some(isNaN)) {
    throw new Error(`Invalid time format: ${time}`);
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return (minutes * 60 + seconds) * 1000;
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  }

  throw new Error("Invalid time format. Use MM:SS or HH:MM:SS");
}

/**
 * Get track thumbnail URL from various sources
 */
export function getThumbnail(track: Track): string | null {
  if (track.info.artworkUrl) {
    return track.info.artworkUrl;
  }

  // YouTube
  if (track.info.sourceName === "youtube") {
    return `https://img.youtube.com/vi/${track.info.identifier}/maxresdefault.jpg`;
  }

  // SoundCloud
  if (track.info.sourceName === "soundcloud") {
    return track.info.artworkUrl ?? null;
  }

  return null;
}

/**
 * Predefined equalizer presets
 */
export const EqualizerPresets: Record<string, EqualizerBand[]> = {
  flat: Array.from({ length: 15 }, (_, i) => ({ band: i, gain: 0 })),

  boost: [
    { band: 0, gain: -0.075 },
    { band: 1, gain: 0.125 },
    { band: 2, gain: 0.125 },
    { band: 3, gain: 0.1 },
    { band: 4, gain: 0.1 },
    { band: 5, gain: 0.05 },
    { band: 6, gain: 0.075 },
    { band: 7, gain: 0.0 },
    { band: 8, gain: 0.0 },
    { band: 9, gain: 0.0 },
    { band: 10, gain: 0.0 },
    { band: 11, gain: 0.0 },
    { band: 12, gain: 0.125 },
    { band: 13, gain: 0.15 },
    { band: 14, gain: 0.05 },
  ],

  metal: [
    { band: 0, gain: 0.0 },
    { band: 1, gain: 0.1 },
    { band: 2, gain: 0.15 },
    { band: 3, gain: 0.13 },
    { band: 4, gain: 0.1 },
    { band: 5, gain: 0.03 },
    { band: 6, gain: 0.07 },
    { band: 7, gain: 0.1 },
    { band: 8, gain: 0.1 },
    { band: 9, gain: 0.1 },
    { band: 10, gain: 0.1 },
    { band: 11, gain: 0.1 },
    { band: 12, gain: 0.15 },
    { band: 13, gain: 0.13 },
    { band: 14, gain: 0.1 },
  ],

  piano: [
    { band: 0, gain: -0.25 },
    { band: 1, gain: -0.25 },
    { band: 2, gain: -0.125 },
    { band: 3, gain: 0.0 },
    { band: 4, gain: 0.25 },
    { band: 5, gain: 0.25 },
    { band: 6, gain: 0.0 },
    { band: 7, gain: -0.25 },
    { band: 8, gain: -0.25 },
    { band: 9, gain: 0.0 },
    { band: 10, gain: 0.0 },
    { band: 11, gain: 0.5 },
    { band: 12, gain: 0.25 },
    { band: 13, gain: -0.025 },
    { band: 14, gain: 0.0 },
  ],

  bass: [
    { band: 0, gain: 0.2 },
    { band: 1, gain: 0.15 },
    { band: 2, gain: 0.1 },
    { band: 3, gain: 0.05 },
    { band: 4, gain: 0.0 },
    { band: 5, gain: -0.05 },
    { band: 6, gain: -0.1 },
    { band: 7, gain: -0.1 },
    { band: 8, gain: -0.1 },
    { band: 9, gain: -0.1 },
    { band: 10, gain: -0.1 },
    { band: 11, gain: -0.1 },
    { band: 12, gain: -0.1 },
    { band: 13, gain: -0.1 },
    { band: 14, gain: -0.1 },
  ],

  radio: [
    { band: 0, gain: 0.0 },
    { band: 1, gain: 0.0 },
    { band: 2, gain: 0.0 },
    { band: 3, gain: 0.0 },
    { band: 4, gain: 0.2 },
    { band: 5, gain: 0.2 },
    { band: 6, gain: 0.2 },
    { band: 7, gain: 0.2 },
    { band: 8, gain: 0.2 },
    { band: 9, gain: 0.2 },
    { band: 10, gain: 0.0 },
    { band: 11, gain: 0.0 },
    { band: 12, gain: 0.0 },
    { band: 13, gain: 0.0 },
    { band: 14, gain: 0.0 },
  ],

  treblebass: [
    { band: 0, gain: 0.2 },
    { band: 1, gain: 0.15 },
    { band: 2, gain: 0.1 },
    { band: 3, gain: 0.05 },
    { band: 4, gain: 0.0 },
    { band: 5, gain: -0.05 },
    { band: 6, gain: -0.1 },
    { band: 7, gain: -0.1 },
    { band: 8, gain: 0.0 },
    { band: 9, gain: 0.0 },
    { band: 10, gain: 0.05 },
    { band: 11, gain: 0.1 },
    { band: 12, gain: 0.15 },
    { band: 13, gain: 0.2 },
    { band: 14, gain: 0.15 },
  ],

  nightcore: [
    { band: 0, gain: 0.0 },
    { band: 1, gain: 0.0 },
    { band: 2, gain: 0.0 },
    { band: 3, gain: 0.0 },
    { band: 4, gain: 0.0 },
    { band: 5, gain: 0.0 },
    { band: 6, gain: 0.0 },
    { band: 7, gain: 0.0 },
    { band: 8, gain: 0.15 },
    { band: 9, gain: 0.15 },
    { band: 10, gain: 0.15 },
    { band: 11, gain: 0.15 },
    { band: 12, gain: 0.15 },
    { band: 13, gain: 0.15 },
    { band: 14, gain: 0.0 },
  ],

  vaporwave: [
    { band: 0, gain: 0.0 },
    { band: 1, gain: 0.0 },
    { band: 2, gain: 0.0 },
    { band: 3, gain: 0.0 },
    { band: 4, gain: 0.0 },
    { band: 5, gain: 0.0 },
    { band: 6, gain: 0.0 },
    { band: 7, gain: 0.0 },
    { band: 8, gain: 0.15 },
    { band: 9, gain: 0.15 },
    { band: 10, gain: 0.15 },
    { band: 11, gain: 0.15 },
    { band: 12, gain: 0.15 },
    { band: 13, gain: 0.15 },
    { band: 14, gain: 0.15 },
  ],
};

/**
 * Create a progress bar for track position
 */
export function createProgressBar(
  position: number,
  duration: number,
  length = 20,
  filled = "▬",
  empty = "▬",
  indicator = "🔘"
): string {
  const progress = Math.min(Math.max(position / duration, 0), 1);
  const filledLength = Math.round(progress * length);
  const emptyLength = length - filledLength;

  return filled.repeat(filledLength) + indicator + empty.repeat(emptyLength);
}

/**
 * Parse Lavalink node connection string
 */
export function parseNodeUrl(url: string): {
  host: string;
  port: number;
  secure: boolean;
} {
  const parsed = new URL(url);

  return {
    host: parsed.hostname,
    port: parseInt(parsed.port) || (parsed.protocol === "https:" ? 443 : 80),
    secure: parsed.protocol === "https:" || parsed.protocol === "wss:",
  };
}

/**
 * Filter builder for easy filter creation
 */
export class FilterBuilder {
  private filters: FilterOptions = {};

  /**
   * Apply bass boost
   */
  bassBoost(level: "low" | "medium" | "high" = "medium"): this {
    const gains = {
      low: 0.1,
      medium: 0.2,
      high: 0.3,
    };

    this.filters.equalizer = [
      { band: 0, gain: gains[level] },
      { band: 1, gain: gains[level] * 0.75 },
      { band: 2, gain: gains[level] * 0.5 },
      { band: 3, gain: gains[level] * 0.25 },
    ];

    return this;
  }

  /**
   * Apply nightcore effect
   */
  nightcore(): this {
    this.filters.timescale = {
      speed: 1.2,
      pitch: 1.2,
      rate: 1.0,
    };
    this.filters.equalizer = EqualizerPresets.nightcore;
    return this;
  }

  /**
   * Apply vaporwave effect
   */
  vaporwave(): this {
    this.filters.timescale = {
      speed: 0.8,
      pitch: 0.8,
      rate: 1.0,
    };
    this.filters.equalizer = EqualizerPresets.vaporwave;
    return this;
  }

  /**
   * Apply 8D audio effect
   */
  eightD(): this {
    this.filters.rotation = {
      rotationHz: 0.2,
    };
    return this;
  }

  /**
   * Apply karaoke effect
   */
  karaoke(level = 1.0): this {
    this.filters.karaoke = {
      level,
      monoLevel: 1.0,
      filterBand: 220.0,
      filterWidth: 100.0,
    };
    return this;
  }

  /**
   * Set custom timescale
   */
  timescale(options: TimescaleOptions): this {
    this.filters.timescale = options;
    return this;
  }

  /**
   * Set custom equalizer
   */
  equalizer(bands: EqualizerBand[]): this {
    this.filters.equalizer = bands;
    return this;
  }

  /**
   * Apply equalizer preset
   */
  equalizerPreset(preset: keyof typeof EqualizerPresets): this {
    this.filters.equalizer = EqualizerPresets[preset];
    return this;
  }

  /**
   * Set volume
   */
  volume(level: number): this {
    if (level < 0 || level > 5) {
      throw new RangeError("Volume must be between 0 and 5");
    }
    this.filters.volume = level;
    return this;
  }

  /**
   * Add tremolo effect
   */
  tremolo(frequency = 2.0, depth = 0.5): this {
    this.filters.tremolo = { frequency, depth };
    return this;
  }

  /**
   * Add vibrato effect
   */
  vibrato(frequency = 2.0, depth = 0.5): this {
    this.filters.vibrato = { frequency, depth };
    return this;
  }

  /**
   * Add low pass filter
   */
  lowPass(smoothing = 20.0): this {
    this.filters.lowPass = { smoothing };
    return this;
  }

  /**
   * Reset all filters
   */
  reset(): this {
    this.filters = {};
    return this;
  }

  /**
   * Build and return the filters
   */
  build(): FilterOptions {
    return { ...this.filters };
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Calculate percentage
 */
export function percentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
