/**
 * @file Unit tests for PermissionCard — renders details and handles Allow/Deny clicks.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionCard } from './PermissionCard';

describe('PermissionCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders permission details', () => {
    render(
      <PermissionCard
        id="perm-1"
        type="bash"
        title="Run bash command"
        metadata={{ command: 'ls -la' }}
        onReply={() => {}}
      />,
    );

    expect(screen.getByText('Run bash command')).toBeInTheDocument();
    expect(screen.getByText('Type: Execute Terminal Command')).toBeInTheDocument();
    expect(screen.getByText('$ ls -la')).toBeInTheDocument();
  });

  it('calls onReply with allow=true when Allow is clicked', () => {
    const onReply = vi.fn();

    render(
      <PermissionCard
        id="perm-1"
        type="bash"
        title="Run bash command"
        metadata={{}}
        onReply={onReply}
      />,
    );

    fireEvent.click(screen.getByText('Allow'));
    expect(onReply).toHaveBeenCalledWith('perm-1', true);
  });

  it('calls onReply with allow=false when Deny is clicked', () => {
    const onReply = vi.fn();

    render(
      <PermissionCard
        id="perm-1"
        type="bash"
        title="Run bash command"
        metadata={{}}
        onReply={onReply}
      />,
    );

    fireEvent.click(screen.getByText('Deny'));
    expect(onReply).toHaveBeenCalledWith('perm-1', false);
  });

  it('regression: renders diff preview for edit permission requests', () => {
    const { container } = render(
      <PermissionCard
        id="perm-2"
        type="edit"
        title="Edit file permission request"
        metadata={{
          filepath: 'src/config.json',
          diff: '--- a/src/config.json\n+++ b/src/config.json\n@@ -1,2 +1,2 @@\n-port: 3000\n+port: 4000',
        }}
        onReply={() => {}}
      />,
    );

    expect(screen.getByText('Edit: src/config.json')).toBeInTheDocument();
    expect(container.querySelector('.diff-table')).toBeInTheDocument();
    expect(screen.getByText('port: 3000')).toBeInTheDocument();
    expect(screen.getByText('port: 4000')).toBeInTheDocument();
  });
});
