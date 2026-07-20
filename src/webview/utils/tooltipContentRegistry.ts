/**
 * @file Registry bridging DOM-created tooltip targets with React tooltip content.
 */

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

const tooltipContents = new Map<string, ReactNode>();
const elementTooltipIds = new WeakMap<HTMLElement, string>();
let nextTooltipContentId = 0;
let removalObserver: MutationObserver | undefined;

/**
 * Stores React content and returns an identifier that can safely be placed on a DOM element.
 *
 * @param content The tooltip content to render when its target is hovered.
 * @returns An identifier for use in the data-custom-title-content attribute.
 */
export function registerTooltipContent(content: ReactNode): string {
  const id = `tooltip-content-${nextTooltipContentId++}`;
  tooltipContents.set(id, content);
  return id;
}

/**
 * Replaces content for an existing tooltip target without changing its DOM attribute.
 *
 * @param id The existing tooltip content identifier.
 * @param content The replacement React content.
 */
export function updateTooltipContent(id: string, content: ReactNode): void {
  tooltipContents.set(id, content);
}

/**
 * Removes content after its React-owned target unmounts.
 *
 * @param id The tooltip content identifier to remove.
 */
export function unregisterTooltipContent(id: string): void {
  tooltipContents.delete(id);
}

/**
 * Starts observing DOM removals so content created outside React is released with its chip element.
 */
function ensureRemovalObserver(): void {
  if (removalObserver || typeof document === 'undefined' || !document.body) return;

  removalObserver = new MutationObserver((records) => {
    for (const record of records) {
      for (const removedNode of record.removedNodes) {
        if (!(removedNode instanceof HTMLElement)) continue;

        const targets = [
          ...(removedNode.matches('[data-custom-title-content]') ? [removedNode] : []),
          ...removedNode.querySelectorAll<HTMLElement>('[data-custom-title-content]'),
        ];
        for (const target of targets) {
          if (target.isConnected) continue;
          const id = elementTooltipIds.get(target);
          if (id) unregisterTooltipContent(id);
          elementTooltipIds.delete(target);
        }
      }
    }
  });
  removalObserver.observe(document.body, { childList: true, subtree: true });
}

/**
 * Associates React content with a DOM-created tooltip target and reuses its ID when refreshed.
 *
 * @param element The chip element that owns the tooltip content.
 * @param content The current tooltip React content.
 * @returns The stable identifier assigned to the element.
 */
export function setElementTooltipContent(element: HTMLElement, content: ReactNode): string {
  ensureRemovalObserver();
  const existingId = elementTooltipIds.get(element);
  if (existingId) {
    updateTooltipContent(existingId, content);
    return existingId;
  }

  const id = registerTooltipContent(content);
  elementTooltipIds.set(element, id);
  element.setAttribute('data-custom-title-content', id);
  // Detached nodes are invisible to the document observer, so release abandoned creations separately.
  queueMicrotask(() => {
    if (!element.isConnected) {
      unregisterTooltipContent(id);
      elementTooltipIds.delete(element);
    }
  });
  return id;
}

/**
 * Registers React-owned tooltip content for the lifecycle of its host component.
 *
 * @param content The tooltip content to keep synchronized with the host component.
 * @returns A stable identifier for the data-custom-title-content attribute.
 */
export function useTooltipContent(content: ReactNode): string {
  const [id] = useState(() => registerTooltipContent(content));

  useEffect(() => {
    updateTooltipContent(id, content);
  }, [content, id]);

  useEffect(() => {
    return () => {
      unregisterTooltipContent(id);
    };
  }, [id]);

  return id;
}

/**
 * Retrieves tooltip content registered for a DOM target.
 *
 * @param id The tooltip content identifier stored on a DOM element.
 * @returns The registered React content, if still available.
 */
export function getRegisteredTooltipContent(id: string | null): ReactNode | undefined {
  return id ? tooltipContents.get(id) : undefined;
}
