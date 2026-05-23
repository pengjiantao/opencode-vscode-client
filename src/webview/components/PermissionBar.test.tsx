/**
 * @file Unit tests for PermissionBar — renders summaries and handles action clicks.
 */

import type { PermissionRequest } from '@opencode-ai/sdk/v2/client';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStore } from '../store/sessionStore';
import { PermissionBar } from './PermissionBar';

describe('PermissionBar', () => {
  const mockOnReply = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.setState({
      pendingPermissions: [],
    });
  });

  it('renders nothing when there are no pending permissions', () => {
    const { container } = render(<PermissionBar sessionID="session-1" onReply={mockOnReply} />);
    expect(container.firstChild).toBeNull();
  });

  it('filters pending permissions by session ID', () => {
    const perm1: PermissionRequest = {
      id: 'perm-1',
      sessionID: 'session-1',
      permission: 'read_file',
      patterns: [],
      metadata: { filePath: '/src/file1.ts' },
      always: [],
    };
    const perm2: PermissionRequest = {
      id: 'perm-2',
      sessionID: 'session-2',
      permission: 'write_file',
      patterns: [],
      metadata: { filePath: '/src/file2.ts' },
      always: [],
    };

    useSessionStore.setState({
      pendingPermissions: [perm1, perm2],
    });

    render(<PermissionBar sessionID="session-1" onReply={mockOnReply} />);

    expect(screen.getByText('Read file /src/file1.ts')).toBeInTheDocument();
    expect(screen.queryByText('Edit file /src/file2.ts')).toBeNull();
  });

  it('summarizes different permission types correctly', () => {
    const permissions: PermissionRequest[] = [
      {
        id: 'perm-1',
        sessionID: 'session-1',
        permission: 'external_directory',
        patterns: [],
        metadata: { path: '/tmp' },
        always: [],
      },
      {
        id: 'perm-2',
        sessionID: 'session-1',
        permission: 'bash',
        patterns: [],
        metadata: { command: 'git status' },
        always: [],
      },
      {
        id: 'perm-3',
        sessionID: 'session-1',
        permission: 'edit',
        patterns: [],
        metadata: { filePath: '/app.js' },
        always: [],
      },
    ];

    useSessionStore.setState({
      pendingPermissions: permissions,
    });

    render(<PermissionBar sessionID="session-1" onReply={mockOnReply} />);

    expect(screen.getByText('Access external directory /tmp')).toBeInTheDocument();
    expect(screen.getByText('Execute command git status')).toBeInTheDocument();
    expect(screen.getByText('Edit file /app.js')).toBeInTheDocument();
  });

  it('triggers onReply and removes permission when Allow is clicked', () => {
    const perm: PermissionRequest = {
      id: 'perm-1',
      sessionID: 'session-1',
      permission: 'read_file',
      patterns: [],
      metadata: { filePath: '/src/file1.ts' },
      always: [],
    };

    useSessionStore.setState({
      pendingPermissions: [perm],
    });

    render(<PermissionBar sessionID="session-1" onReply={mockOnReply} />);

    const allowBtn = screen.getByRole('button', { name: 'Allow' });
    fireEvent.click(allowBtn);

    expect(mockOnReply).toHaveBeenCalledWith('perm-1', 'once');
    expect(useSessionStore.getState().pendingPermissions).toEqual([]);
  });

  it('triggers onReply and removes permission when Always Allow is clicked', () => {
    const perm: PermissionRequest = {
      id: 'perm-1',
      sessionID: 'session-1',
      permission: 'read_file',
      patterns: [],
      metadata: { filePath: '/src/file1.ts' },
      always: [],
    };

    useSessionStore.setState({
      pendingPermissions: [perm],
    });

    render(<PermissionBar sessionID="session-1" onReply={mockOnReply} />);

    const alwaysBtn = screen.getByRole('button', { name: 'Always Allow' });
    fireEvent.click(alwaysBtn);

    expect(mockOnReply).toHaveBeenCalledWith('perm-1', 'always');
    expect(useSessionStore.getState().pendingPermissions).toEqual([]);
  });

  it('triggers onReply and removes permission when Deny is clicked', () => {
    const perm: PermissionRequest = {
      id: 'perm-1',
      sessionID: 'session-1',
      permission: 'read_file',
      patterns: [],
      metadata: { filePath: '/src/file1.ts' },
      always: [],
    };

    useSessionStore.setState({
      pendingPermissions: [perm],
    });

    render(<PermissionBar sessionID="session-1" onReply={mockOnReply} />);

    const denyBtn = screen.getByRole('button', { name: 'Deny' });
    fireEvent.click(denyBtn);

    expect(mockOnReply).toHaveBeenCalledWith('perm-1', 'reject');
    expect(useSessionStore.getState().pendingPermissions).toEqual([]);
  });
});
