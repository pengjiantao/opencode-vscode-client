/**
 * @file Unit tests for the Popover component.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Popover } from './Popover';

describe('Popover Component', () => {
  it('should render the trigger and toggle the popover content on click', () => {
    render(
      <Popover trigger={<button>Open Menu</button>}>
        <div data-testid="popover-content">Popover Body</div>
      </Popover>,
    );

    // Trigger should be in document
    const trigger = screen.getByRole('button', { name: 'Open Menu' });
    expect(trigger).toBeInTheDocument();

    // Content should NOT be open initially
    expect(screen.queryByTestId('popover-content')).toBeNull();

    // Clicking trigger opens it
    fireEvent.click(trigger);
    expect(screen.getByTestId('popover-content')).toBeInTheDocument();

    // Clicking trigger again closes it
    fireEvent.click(trigger);
    expect(screen.queryByTestId('popover-content')).toBeNull();
  });

  it('should support the render-prop function signature and allow internal closing', () => {
    render(
      <Popover trigger={<button>Open Menu</button>}>
        {({ close }) => (
          <div data-testid="popover-content">
            <button onClick={close} data-testid="close-btn">
              Close Me
            </button>
          </div>
        )}
      </Popover>,
    );

    const trigger = screen.getByRole('button', { name: 'Open Menu' });
    fireEvent.click(trigger);
    expect(screen.getByTestId('popover-content')).toBeInTheDocument();

    // Clicking inside close-btn closes popover
    const closeBtn = screen.getByTestId('close-btn');
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('popover-content')).toBeNull();
  });

  it('should close popover on click outside', () => {
    render(
      <div>
        <div data-testid="outside-element">Outside</div>
        <Popover trigger={<button>Open Menu</button>}>
          <div data-testid="popover-content">Popover Body</div>
        </Popover>
      </div>,
    );

    const trigger = screen.getByRole('button', { name: 'Open Menu' });
    fireEvent.click(trigger);
    expect(screen.getByTestId('popover-content')).toBeInTheDocument();

    // Clicking outside element closes the popover
    const outside = screen.getByTestId('outside-element');
    fireEvent.mouseDown(outside);
    expect(screen.queryByTestId('popover-content')).toBeNull();
  });

  it('should close popover when pressing the Escape key', () => {
    render(
      <Popover trigger={<button>Open Menu</button>}>
        <div data-testid="popover-content">Popover Body</div>
      </Popover>,
    );

    const trigger = screen.getByRole('button', { name: 'Open Menu' });
    fireEvent.click(trigger);
    expect(screen.getByTestId('popover-content')).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByTestId('popover-content')).toBeNull();
  });
});
