import type { Session } from '@opencode-ai/sdk';

interface SessionTabsProps {
  sessions: Session[];
  activeSessionID: string | null;
  onSwitch: (sessionID: string) => void;
  onCreate: () => void;
  onArchive: (sessionID: string) => void;
  onSelectHistory?: () => void;
  onSettings?: () => void;
}

export function SessionTabs({
  sessions,
  activeSessionID,
  onSwitch,
  onCreate,
  onArchive,
  onSelectHistory,
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
            title={session.title || 'Untitled'}
          >
            <span className="tab-title">{session.title || 'Untitled'}</span>
          </button>
        ))}
      </div>

      <div className="tabs-actions">
        <button onClick={onCreate} title="Create New Session">
          + New
        </button>
        {onSelectHistory && (
          <button onClick={onSelectHistory} title="Select Previous Session from History">
            History
          </button>
        )}
        {activeSessionID && (
          <button onClick={() => onArchive(activeSessionID)} title="Archive Session">
            Archive
          </button>
        )}
        {onSettings && (
          <button onClick={onSettings} title="Settings">
            ⚙
          </button>
        )}
      </div>
    </div>
  );
}
