/**
 * @file Unit tests for the Select component.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Select } from './Select';

const mockOptions = [
  { id: 'opt1', label: 'Option One', group: 'Group A' },
  { id: 'opt2', label: 'Option Two', group: 'Group A' },
  { id: 'opt3', label: 'Option Three', group: 'Group B' },
  { id: 'opt4', label: 'Option Four' },
];

describe('Select Component', () => {
  it('should render trigger text representing selected value', () => {
    render(<Select options={mockOptions} value="opt1" onChange={vi.fn()} />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('Option One');
  });

  it('should render standard trigger fallback when value is not matched', () => {
    render(<Select options={mockOptions} value="not-found" onChange={vi.fn()} />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('not-found');
  });

  it('should show options and trigger onChange when option is clicked', () => {
    const handleChange = vi.fn();
    render(<Select options={mockOptions} value="opt1" onChange={handleChange} />);

    // Open select dropdown
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    // Click third option
    const option = screen.getByRole('option', { name: 'Option Three' });
    expect(option).toBeInTheDocument();

    fireEvent.click(option);
    expect(handleChange).toHaveBeenCalledWith('opt3');
  });

  it('should render groups correctly if provided in options', () => {
    render(<Select options={mockOptions} value="opt1" onChange={vi.fn()} />);

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    const groupA = screen.getByRole('group', { name: 'Group A' });
    expect(groupA).toBeInTheDocument();

    const header = groupA.querySelector('.select-group-header');
    expect(header).toHaveTextContent('Group A');
  });

  it('should display search input and filter results if searchable', () => {
    render(<Select options={mockOptions} value="opt1" onChange={vi.fn()} searchable={true} />);

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    const searchInput = screen.getByPlaceholderText('Search...');
    expect(searchInput).toBeInTheDocument();

    // Type query matching Group B or Three
    fireEvent.change(searchInput, { target: { value: 'Three' } });

    // Option Three is visible, others are not
    expect(screen.getByRole('option', { name: 'Option Three' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Option One' })).toBeNull();
  });

  it('should render no results container if search has no matches', () => {
    render(
      <Select
        options={mockOptions}
        value="opt1"
        onChange={vi.fn()}
        searchable={true}
        noResultsText="Nothing matched"
      />,
    );

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'xyz123' } });

    expect(screen.getByText('Nothing matched')).toBeInTheDocument();
  });

  it('should show loading indicator text if loading state active', () => {
    render(
      <Select
        options={mockOptions}
        value="opt1"
        onChange={vi.fn()}
        isLoading={true}
        loadingText="Fetching..."
      />,
    );

    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('Fetching...');
    expect(trigger).toBeDisabled();
  });
});
