/**
 * @file Unit tests for the FileIcon component.
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FileIcon } from './FileIcon';

describe('FileIcon', () => {
  it('renders an <img> for a known extension', () => {
    const { container } = render(<FileIcon path="src/helper.ts" />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBeTruthy();
    expect(img?.getAttribute('width')).toBe('16');
    expect(img?.getAttribute('height')).toBe('16');
  });

  it('sets aria-hidden when alt is empty', () => {
    const { container } = render(<FileIcon path="helper.ts" />);
    const img = container.querySelector('img');
    expect(img?.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps the alt text when provided', () => {
    const { container } = render(<FileIcon path="helper.ts" alt="TypeScript" />);
    const img = container.querySelector('img');
    expect(img?.getAttribute('alt')).toBe('TypeScript');
    expect(img?.getAttribute('aria-hidden')).toBeNull();
  });

  it('falls back to a generic codicon for unknown extensions', () => {
    const { container } = render(<FileIcon path="weird.zzznotreal" />);
    expect(container.querySelector('img')).toBeNull();
    const codicon = container.querySelector('.codicon.codicon-file');
    expect(codicon).not.toBeNull();
  });

  it('falls back when no path is given', () => {
    const { container } = render(<FileIcon />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.codicon.codicon-file')).not.toBeNull();
  });

  it('respects the size prop', () => {
    const { container } = render(<FileIcon path="helper.ts" size={24} />);
    const img = container.querySelector('img');
    expect(img?.getAttribute('width')).toBe('24');
    expect(img?.getAttribute('height')).toBe('24');
  });

  it('appends className when provided', () => {
    const { container } = render(<FileIcon path="helper.ts" className="custom-class" />);
    const img = container.querySelector('img');
    expect(img?.classList.contains('custom-class')).toBe(true);
  });
});
