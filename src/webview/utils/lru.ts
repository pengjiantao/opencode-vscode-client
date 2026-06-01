/**
 * @file A simple bounded Map-based LRU (least recently used) cache.
 * Used to memoize expensive pure functions like diff parsing.
 *
 * Cache key semantics: identity (===) is used for both reads and writes.
 * Callers that need value-based keys should normalize/hashing before lookup.
 */

export class LRUCache<K, V> {
  private readonly store = new Map<K, V>();

  constructor(private readonly maxSize: number) {
    if (maxSize <= 0) {
      throw new Error('LRUCache maxSize must be > 0');
    }
  }

  /** Returns the cached value and marks the entry as most recently used. */
  get(key: K): V | undefined {
    const value = this.store.get(key);
    if (value === undefined) return undefined;
    // Refresh recency by re-inserting (Map iteration order = insertion order).
    this.store.delete(key);
    this.store.set(key, value);
    return value;
  }

  /** Inserts a value, evicting the least recently used entry if at capacity. */
  set(key: K, value: V): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxSize) {
      // Evict oldest entry.
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) {
        this.store.delete(oldest);
      }
    }
    this.store.set(key, value);
  }

  /** Returns the current number of cached entries. */
  get size(): number {
    return this.store.size;
  }

  /** Removes all cached entries. */
  clear(): void {
    this.store.clear();
  }
}
