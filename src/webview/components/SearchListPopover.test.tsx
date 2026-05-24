/**
 * @file Unit tests for SearchListPopover generic search-list component.
 * Verifies show/hide, empty state, item rendering, click callbacks, and scroll behavior.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SearchListPopover } from './SearchListPopover';

interface TestItem {
  id: number;
  label: string;
}

describe('SearchListPopover', () => {
  const items: TestItem[] = [
    { id: 1, label: 'Item One' },
    { id: 2, label: 'Item Two' },
  ];

  const renderItem = (item: TestItem, _index: number, isSelected: boolean) => (
    <span className={isSelected ? 'selected' : ''}>{item.label}</span>
  );

  it('should render nothing when show is false', () => {
    const { container } = render(
      <SearchListPopover
        show={false}
        items={items}
        selectedIndex={0}
        onSelect={vi.fn()}
        getKey={(i) => String(i.id)}
        renderItem={renderItem}
        emptyText="No items"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render empty text when items array is empty', () => {
    render(
      <SearchListPopover
        show={true}
        items={[]}
        selectedIndex={0}
        onSelect={vi.fn()}
        getKey={(i) => String(i.id)}
        renderItem={renderItem}
        emptyText="No items available"
      />,
    );
    expect(screen.getByText('No items available')).toBeInTheDocument();
  });

  it('should render all items', () => {
    render(
      <SearchListPopover
        show={true}
        items={items}
        selectedIndex={0}
        onSelect={vi.fn()}
        getKey={(i) => String(i.id)}
        renderItem={renderItem}
        emptyText="No items"
      />,
    );
    expect(screen.getByText('Item One')).toBeInTheDocument();
    expect(screen.getByText('Item Two')).toBeInTheDocument();
  });

  it('should call onSelect when an item is clicked', () => {
    const onSelect = vi.fn();
    render(
      <SearchListPopover
        show={true}
        items={items}
        selectedIndex={0}
        onSelect={onSelect}
        getKey={(i) => String(i.id)}
        renderItem={renderItem}
        emptyText="No items"
      />,
    );
    fireEvent.click(screen.getByText('Item Two'));
    expect(onSelect).toHaveBeenCalledWith(items[1]);
  });

  it('should adjust container scrollTop to keep selected element in view', () => {
    const { container, rerender } = render(
      <SearchListPopover
        show={true}
        items={items}
        selectedIndex={0}
        onSelect={vi.fn()}
        getKey={(i) => String(i.id)}
        renderItem={renderItem}
        emptyText="No items"
      />,
    );

    const popoverContainer = container.querySelector('.search-list-popover') as HTMLElement;
    Object.defineProperty(popoverContainer, 'clientHeight', { value: 100 });
    Object.defineProperty(popoverContainer, 'scrollTop', { value: 0, writable: true });

    const listItems = container.querySelectorAll('.search-list-item');
    // Mock first item
    Object.defineProperty(listItems[0], 'offsetTop', { value: 0 });
    Object.defineProperty(listItems[0], 'offsetHeight', { value: 30 });

    // Mock second item (out of view at bottom)
    Object.defineProperty(listItems[1], 'offsetTop', { value: 120 });
    Object.defineProperty(listItems[1], 'offsetHeight', { value: 30 });

    rerender(
      <SearchListPopover
        show={true}
        items={items}
        selectedIndex={1}
        onSelect={vi.fn()}
        getKey={(i) => String(i.id)}
        renderItem={renderItem}
        emptyText="No items"
      />,
    );

    // Should scroll down to show the bottom of the second item
    // container.scrollTop = offsetTop (120) + itemHeight (30) - containerHeight (100) = 50
    expect(popoverContainer.scrollTop).toBe(50);

    // Now test scrolling up
    Object.defineProperty(popoverContainer, 'scrollTop', { value: 100, writable: true });

    rerender(
      <SearchListPopover
        show={true}
        items={items}
        selectedIndex={0}
        onSelect={vi.fn()}
        getKey={(i) => String(i.id)}
        renderItem={renderItem}
        emptyText="No items"
      />,
    );

    // Should scroll up to show the top of the first item
    // container.scrollTop = offsetTop (0)
    expect(popoverContainer.scrollTop).toBe(0);
  });
});
