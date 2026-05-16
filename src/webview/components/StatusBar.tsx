import type { SessionStatus } from '@opencode-ai/sdk';

interface StatusBarProps {
  sessionID: string | null;
  status: SessionStatus | undefined;
}

export function StatusBar({ sessionID, status }: StatusBarProps) {
  if (!sessionID) {
    return null;
  }

  const getStatusText = () => {
    if (!status) return 'Idle';
    switch (status.type) {
      case 'idle':
        return 'Ready';
      case 'busy':
        return 'Processing...';
      case 'retry':
        return `Retrying (${status.attempt}/${status.next})`;
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = () => {
    if (!status) return 'var(--vscode-editor-foreground)';
    switch (status.type) {
      case 'idle':
        return 'var(--vscode-editor-foreground)';
      case 'busy':
        return 'var(--vscode-progressBar-background)';
      case 'retry':
        return 'var(--vscode-textLink-foreground)';
      default:
        return 'var(--vscode-editor-foreground)';
    }
  };

  return (
    <div className="status-bar">
      <div className="status-indicator" style={{ color: getStatusColor() }}>
        <span className="status-dot" style={{ backgroundColor: getStatusColor() }} />
        <span className="status-text">{getStatusText()}</span>
      </div>
    </div>
  );
}
