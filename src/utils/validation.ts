/**
 * Validation utilities for Rias
 */
export class ValidationUtils {
  /**
   * Validate volume (0-1000)
   */
  static isValidVolume(volume: number): boolean {
    return (
      typeof volume === "number" &&
      Number.isInteger(volume) &&
      volume >= 0 &&
      volume <= 1000
    );
  }

  /**
   * Validate position (non-negative integer)
   */
  static isValidPosition(position: number): boolean {
    return (
      typeof position === "number" &&
      Number.isInteger(position) &&
      position >= 0
    );
  }

  /**
   * Sanitize search query
   */
  static sanitizeSearchQuery(query: string): string {
    if (typeof query !== "string") {
      throw new TypeError("Search query must be a string");
    }

    // Trim whitespace and limit length
    return query.trim().slice(0, 500);
  }

  /**
   * Validate URL
   */
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate guild ID (Discord snowflake: 17-20 digit string)
   */
  static isValidGuildId(guildId: string): boolean {
    return typeof guildId === "string" && /^\d{17,20}$/.test(guildId);
  }

  /**
   * Validate channel ID (Discord snowflake: 17-20 digit string)
   */
  static isValidChannelId(channelId: string): boolean {
    return typeof channelId === "string" && /^\d{17,20}$/.test(channelId);
  }

  /**
   * Validate equalizer band
   */
  static isValidEqualizerBand(band: number, gain: number): boolean {
    return (
      typeof band === "number" &&
      Number.isInteger(band) &&
      band >= 0 &&
      band <= 14 &&
      typeof gain === "number" &&
      gain >= -0.25 &&
      gain <= 1.0
    );
  }

  /**
   * Validate timescale options
   */
  static isValidTimescale(
    speed?: number,
    pitch?: number,
    rate?: number
  ): boolean {
    const isValidParam = (param: number | undefined) =>
      param === undefined ||
      (typeof param === "number" && param > 0 && param <= 10);

    return isValidParam(speed) && isValidParam(pitch) && isValidParam(rate);
  }
}
