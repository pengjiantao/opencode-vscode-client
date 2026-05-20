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

  it('should scroll selected element into view', () => {
    const scrollSpy = vi.fn();

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

    const listItems = container.querySelectorAll('.search-list-item');
    listItems.forEach((el) => {
      el.scrollIntoView = scrollSpy;
    });

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

    expect(scrollSpy).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'center',
      inline: 'nearest',
    });
  });
});
