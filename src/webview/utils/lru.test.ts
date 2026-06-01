/**
 * @file Unit tests for the LRU cache.
 */

import { describe, expect, it } from 'vitest';
import { LRUCache } from './lru';

describe('LRUCache', () => {
  it('stores and retrieves values', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
  });

  it('returns undefined for missing keys', () => {
    const cache = new LRUCache<string, number>(3);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('evicts the least recently used entry when capacity is exceeded', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });

  it('refreshes recency on read', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    // Reading 'a' makes it the most recent.
    cache.get('a');
    cache.set('c', 3);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
  });

  it('updates existing keys without growing size', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.set('a', 2);
    expect(cache.size).toBe(1);
    expect(cache.get('a')).toBe(2);
  });

  it('clear empties the cache', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });

  it('throws on non-positive maxSize', () => {
    expect(() => new LRUCache<string, number>(0)).toThrow();
    expect(() => new LRUCache<string, number>(-1)).toThrow();
  });
});
