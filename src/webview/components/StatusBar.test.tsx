/**
 * @file Unit tests for StatusBar — renders correct text per status type (idle, busy, retry).
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockSessionStatus } from '../../test/mocks/sdk';
import { StatusBar } from './StatusBar';

describe('StatusBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when sessionID is null', () => {
    const { container } = render(<StatusBar sessionID={null} status={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders Ready when status is idle', () => {
    render(<StatusBar sessionID="session-1" status={createMockSessionStatus()} />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('renders Processing when status is busy', () => {
    render(<StatusBar sessionID="session-1" status={createMockSessionStatus({ type: 'busy' })} />);
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('renders Retrying when status is retry', () => {
    const status = createMockSessionStatus({ type: 'retry', attempt: 2, message: 'test', next: 3 });
    render(<StatusBar sessionID="session-1" status={status} />);
    expect(screen.getByText('Retrying (2/3)')).toBeInTheDocument();
  });
});
