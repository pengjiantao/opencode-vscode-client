import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPanel } from './SettingsPanel';

describe('SettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders settings header', () => {
    render(<SettingsPanel onClose={() => {}} />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders default model field', () => {
    render(<SettingsPanel onClose={() => {}} />);
    expect(screen.getByText('Default Model')).toBeInTheDocument();
  });

  it('renders default agent field', () => {
    render(<SettingsPanel onClose={() => {}} />);
    expect(screen.getByText('Default Agent')).toBeInTheDocument();
  });

  it('renders keyboard shortcuts section', () => {
    render(<SettingsPanel onClose={() => {}} />);
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Create new session')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<SettingsPanel onClose={onClose} />);
    fireEvent.click(screen.getByText('×'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders reset and save buttons', () => {
    render(<SettingsPanel onClose={() => {}} />);
    expect(screen.getByText('Reset')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });
});
