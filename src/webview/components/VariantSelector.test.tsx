/**
 * @file Unit tests for VariantSelector component.
 * Verifies options rendering, click handler, and default state display.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VariantSelector } from './VariantSelector';

describe('VariantSelector', () => {
  const variants = ['low', 'medium', 'high'];
  const mockOnChange = vi.fn();

  it('renders select trigger button with default value', () => {
    render(<VariantSelector variants={variants} value="default" onChange={mockOnChange} />);

    const trigger = screen.getByRole('combobox', { name: /select model variant/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent('Default');
  });

  it('renders select trigger button with specific active variant', () => {
    render(<VariantSelector variants={variants} value="medium" onChange={mockOnChange} />);

    const trigger = screen.getByRole('combobox', { name: /select model variant/i });
    expect(trigger).toHaveTextContent('medium');
  });

  it('displays available variants on click and calls onChange when selected', () => {
    render(<VariantSelector variants={variants} value="default" onChange={mockOnChange} />);

    const trigger = screen.getByRole('combobox', { name: /select model variant/i });
    fireEvent.click(trigger);

    // Verify popover lists options
    expect(screen.getAllByText('Default').length).toBe(2);
    expect(screen.getByText('low')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();

    // Select an option
    fireEvent.click(screen.getByText('medium'));
    expect(mockOnChange).toHaveBeenCalledWith('medium');
  });
});
