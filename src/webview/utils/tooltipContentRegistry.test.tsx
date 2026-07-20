/**
 * @file Tests lifecycle cleanup for React and DOM-owned tooltip registry content.
 */

import { render, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getRegisteredTooltipContent,
  setElementTooltipContent,
  useTooltipContent,
} from './tooltipContentRegistry';

/** Renders one React-owned tooltip target for lifecycle assertions. */
function TooltipTarget({ text }: { text: string }) {
  const tooltipContentId = useTooltipContent(<strong>{text}</strong>);
  return <span data-custom-title-content={tooltipContentId} />;
}

describe('tooltipContentRegistry', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('updates React-owned content without changing its identifier and releases it on unmount', () => {
    const { container, rerender, unmount } = render(
      <StrictMode>
        <TooltipTarget text="Initial" />
      </StrictMode>,
    );
    const target = container.querySelector<HTMLElement>('[data-custom-title-content]');
    const id = target?.getAttribute('data-custom-title-content') || '';

    rerender(
      <StrictMode>
        <TooltipTarget text="Updated" />
      </StrictMode>,
    );

    expect(target?.getAttribute('data-custom-title-content')).toBe(id);
    expect(getRegisteredTooltipContent(id)).toBeDefined();
    unmount();
    expect(getRegisteredTooltipContent(id)).toBeUndefined();
  });

  it('reuses a DOM chip identifier on refresh and releases it when the chip is removed', async () => {
    const target = document.createElement('span');
    document.body.appendChild(target);
    const id = setElementTooltipContent(target, <strong>Initial</strong>);

    expect(setElementTooltipContent(target, <strong>Updated</strong>)).toBe(id);
    target.remove();

    await waitFor(() => {
      expect(getRegisteredTooltipContent(id)).toBeUndefined();
    });
  });

  it('releases a DOM chip that was created but never inserted', async () => {
    const target = document.createElement('span');
    const id = setElementTooltipContent(target, <strong>Abandoned</strong>);

    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(getRegisteredTooltipContent(id)).toBeUndefined();
  });
});
