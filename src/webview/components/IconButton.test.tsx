/**
 * @file Unit tests for the IconButton component.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IconButton } from './IconButton';

describe('IconButton Component', () => {
  it('should render the button with correct icon name', () => {
    render(<IconButton name="close" title="Close" />);
    const button = screen.getByRole('button', { name: 'Close' });
    expect(button).toBeInTheDocument();

    const icon = button.querySelector('.codicon');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('codicon-close');
  });

  it('should trigger onClick handler when clicked', () => {
    const handleClick = vi.fn();
    render(<IconButton name="close" onClick={handleClick} title="Close" />);
    const button = screen.getByRole('button', { name: 'Close' });

    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should apply predefined size classes', () => {
    const { container: containerSmall } = render(<IconButton name="close" size="small" />);
    expect(containerSmall.querySelector('.icon-button')).toHaveClass('icon-button-small');

    const { container: containerLarge } = render(<IconButton name="close" size="large" />);
    expect(containerLarge.querySelector('.icon-button')).toHaveClass('icon-button-large');
  });

  it('should apply custom pixel sizes via inline styles', () => {
    const { container } = render(<IconButton name="close" size={40} />);
    const button = container.querySelector('.icon-button') as HTMLElement;
    expect(button.style.width).toBe('40px');
    expect(button.style.height).toBe('40px');
  });

  it('should honor disabled attribute and not trigger click', () => {
    const handleClick = vi.fn();
    render(<IconButton name="close" onClick={handleClick} disabled={true} title="Close" />);
    const button = screen.getByRole('button', { name: 'Close' });

    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });
});
