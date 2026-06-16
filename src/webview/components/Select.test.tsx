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

describe('Select Combobox Keyboard Interaction', () => {
  /**
   * Helper to open the popover and return the search input + options list refs.
   */
  const openAndGetRefs = (props: {
    options: typeof mockOptions;
    value: string;
    onChange: (v: string) => void;
    searchable?: boolean;
  }) => {
    const utils = render(<Select {...props} searchable={props.searchable ?? true} />);
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    const searchInput = screen.getByPlaceholderText('Search...');
    const optionsList = document.querySelector('.select-options-list') as HTMLElement;
    return { ...utils, trigger, searchInput, optionsList };
  };

  /**
   * Mock offsetTop / offsetHeight / clientHeight / scrollHeight on the given element
   * so the scroll-center math can be tested deterministically.
   */
  const mockOptionMetrics = (
    optionsList: HTMLElement,
    metrics: Array<{ top: number; height: number }>,
  ) => {
    const items = optionsList.querySelectorAll<HTMLElement>('.select-option');
    items.forEach((el, i) => {
      Object.defineProperty(el, 'offsetTop', { value: metrics[i]?.top ?? 0, configurable: true });
      Object.defineProperty(el, 'offsetHeight', {
        value: metrics[i]?.height ?? 30,
        configurable: true,
      });
    });
  };

  const mockListMetrics = (
    optionsList: HTMLElement,
    { clientHeight, scrollHeight }: { clientHeight: number; scrollHeight: number },
  ) => {
    Object.defineProperty(optionsList, 'clientHeight', { value: clientHeight, configurable: true });
    Object.defineProperty(optionsList, 'scrollHeight', { value: scrollHeight, configurable: true });
    Object.defineProperty(optionsList, 'scrollTop', {
      value: 0,
      writable: true,
      configurable: true,
    });
  };

  it('regression: opens and centers the current value in the options list viewport', () => {
    const { optionsList, searchInput } = openAndGetRefs({
      options: mockOptions,
      value: 'opt3',
      onChange: vi.fn(),
    });

    // List viewport is 100px tall; each option is 30px. Option 3 sits at top=80.
    mockListMetrics(optionsList, { clientHeight: 100, scrollHeight: 240 });
    mockOptionMetrics(optionsList, [
      { top: 0, height: 30 },
      { top: 38, height: 30 },
      { top: 80, height: 30 },
      { top: 120, height: 30 },
    ]);

    // Type a query that matches all 4 options (so the DOM nodes are reused and
    // the mocked dimensions persist) then clear, to trigger the scroll-center
    // effect re-evaluation against the mocked metrics.
    fireEvent.change(searchInput, { target: { value: 'Option' } });
    fireEvent.change(searchInput, { target: { value: '' } });

    // desired = offsetTop(80) - clientHeight(100)/2 + itemHeight(30)/2 = 45
    expect(optionsList.scrollTop).toBe(45);
  });

  it('regression: does not crash when current value is filtered out and no scroll target exists', () => {
    const { searchInput } = openAndGetRefs({
      options: mockOptions,
      value: 'opt-unknown',
      onChange: vi.fn(),
    });
    // value is not in mockOptions; opening should not throw, and any interaction
    // should still be safe.
    fireEvent.change(searchInput, { target: { value: 'Three' } });
    expect(screen.getByRole('option', { name: 'Option Three' })).toBeInTheDocument();
  });

  it('regression: ArrowDown moves the keyboard highlight to the next filtered option', () => {
    const { searchInput } = openAndGetRefs({
      options: mockOptions,
      value: 'opt1',
      onChange: vi.fn(),
    });

    const optionOne = screen.getByRole('option', { name: /Option One/ });
    const optionTwo = screen.getByRole('option', { name: /Option Two/ });

    // Option One starts highlighted (value=opt1).
    expect(optionOne).toHaveClass('selected');

    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });

    // Highlight should move to Option Two.
    expect(optionOne).not.toHaveClass('selected');
    expect(optionTwo).toHaveClass('selected');
  });

  it('regression: ArrowDown at the last filtered option wraps to the first', () => {
    const { searchInput } = openAndGetRefs({
      options: mockOptions,
      value: 'opt1',
      onChange: vi.fn(),
    });

    // Narrow to a 2-item list (Option Two and Option Three).
    fireEvent.change(searchInput, { target: { value: 'Option T' } });

    // Active is opt1 (value), which is NOT in the filtered list. The snap effect
    // will move the keyboard highlight to the first result (Option Two).
    // ArrowDown from Option Two wraps back to Option Two's index+1 = Option Three
    // (only 2 items, so a single ArrowDown lands on the last). One more wraps to
    // the first.
    fireEvent.keyDown(searchInput, { key: 'ArrowDown' }); // -> Option Three (last)
    expect(screen.getByRole('option', { name: 'Option Three' })).toHaveClass('selected');

    fireEvent.keyDown(searchInput, { key: 'ArrowDown' }); // wrap -> first (Option Two)
    expect(screen.getByRole('option', { name: 'Option Two' })).toHaveClass('selected');
  });

  it('regression: ArrowUp at the first filtered option wraps to the last', () => {
    const { searchInput } = openAndGetRefs({
      options: mockOptions,
      value: 'opt1',
      onChange: vi.fn(),
    });

    fireEvent.change(searchInput, { target: { value: 'Option ' } });
    // Current active is opt1 (value). ArrowUp wraps to last (opt4 "Option Four").
    fireEvent.keyDown(searchInput, { key: 'ArrowUp' });
    expect(screen.getByRole('option', { name: 'Option Four' })).toHaveClass('selected');
  });

  it('regression: typing in search that excludes the keyboard highlight snaps it to the first result', () => {
    const { searchInput } = openAndGetRefs({
      options: mockOptions,
      value: 'opt1',
      onChange: vi.fn(),
    });

    // First, navigate via keyboard to opt2 (ArrowDown from opt1).
    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: 'Option Two' })).toHaveClass('selected');

    // Now type "Four" — the keyboard highlight (opt2) is no longer in the results.
    // It should snap to the first result (Option Four).
    fireEvent.change(searchInput, { target: { value: 'Four' } });
    expect(screen.getByRole('option', { name: 'Option Four' })).toHaveClass('selected');
    // And the previously highlighted option should no longer be in DOM at all.
    expect(screen.queryByRole('option', { name: 'Option Two' })).toBeNull();
  });

  it('regression: Enter commits the keyboard-highlighted item, not the current value', () => {
    const handleChange = vi.fn();
    const { searchInput } = openAndGetRefs({
      options: mockOptions,
      value: 'opt1',
      onChange: handleChange,
    });

    // Navigate to opt2 with ArrowDown.
    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    // Press Enter to commit.
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith('opt2');
    // Popover should be closed — search input no longer in DOM.
    expect(screen.queryByPlaceholderText('Search...')).toBeNull();
  });

  it('regression: Enter with no real change (highlight equals value) does not call onChange', () => {
    const handleChange = vi.fn();
    const { searchInput } = openAndGetRefs({
      options: mockOptions,
      value: 'opt1',
      onChange: handleChange,
    });

    // No keyboard navigation. Effective highlight is opt1, same as value.
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    // onChange must NOT be called when the would-be commit matches the current value.
    expect(handleChange).not.toHaveBeenCalled();
    // Popover should still close.
    expect(screen.queryByPlaceholderText('Search...')).toBeNull();
  });

  it('regression: mouse click still commits the clicked option and closes the popover', () => {
    const handleChange = vi.fn();
    openAndGetRefs({
      options: mockOptions,
      value: 'opt1',
      onChange: handleChange,
    });

    fireEvent.click(screen.getByRole('option', { name: 'Option Three' }));
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith('opt3');
    expect(screen.queryByRole('option', { name: 'Option Three' })).toBeNull();
  });

  it('regression: reopening the popover starts fresh — stale keyboard highlight is not reused', () => {
    // Simulate a stateful parent: `value` updates when onChange fires, so the
    // popover reopens against the newly committed selection.
    let currentValue = 'opt1';
    const handleChange = vi.fn((next: string) => {
      currentValue = next;
    });
    const utils = render(
      <Select
        options={mockOptions}
        value={currentValue}
        onChange={handleChange}
        searchable={true}
      />,
    );
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);
    const searchInput = screen.getByPlaceholderText('Search...');

    // Navigate to opt2, commit via Enter.
    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    fireEvent.keyDown(searchInput, { key: 'Enter' });
    expect(handleChange).toHaveBeenCalledWith('opt2');

    // The popover is closed. Mirror the parent re-render against the new value.
    utils.rerender(
      <Select
        options={mockOptions}
        value={currentValue}
        onChange={handleChange}
        searchable={true}
      />,
    );

    // Reopen.
    fireEvent.click(trigger);

    // The trigger label should now reflect the new value (opt2 -> Option Two).
    expect(trigger).toHaveTextContent('Option Two');

    // The fresh highlight should be the new value (opt2), NOT a stale ArrowDown state.
    expect(screen.getByRole('option', { name: /Option Two/ })).toHaveClass('selected');
  });
});
