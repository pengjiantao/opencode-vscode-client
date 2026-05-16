import type { Session } from '@opencode-ai/sdk';

interface SessionTabsProps {
  sessions: Session[];
  activeSessionID: string | null;
  onSwitch: (sessionID: string) => void;
  onCreate: () => void;
  onArchive: (sessionID: string) => void;
  onSettings?: () => void;
}

export function SessionTabs({
  sessions,
  activeSessionID,
  onSwitch,
  onCreate,
  onArchive,
  onSettings,
}: SessionTabsProps) {
  return (
    <div className="session-tabs">
      <div className="tabs-list">
        {sessions.map((session) => (
          <button
            key={session.id}
            className={`tab ${session.id === activeSessionID ? 'active' : ''}`}
            onClick={() => onSwitch(session.id)}
          >
            {session.title || 'Untitled'}
          </button>
        ))}
      </div>

      <div className="tabs-actions">
        <button onClick={onCreate}>+ New</button>
        {activeSessionID && <button onClick={() => onArchive(activeSessionID)}>Archive</button>}
        {onSettings && <button onClick={onSettings}>⚙</button>}
      </div>
    </div>
  );
}
