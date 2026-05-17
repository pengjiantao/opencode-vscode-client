/**
 * @file Tab bar showing open sessions with switch, close, and more-actions menu.
 */

import type { Session } from '@opencode-ai/sdk';
import { useEffect, useRef, useState } from 'react';

interface SessionTabsProps {
  sessions: Session[];
  activeSessionID: string | null;
  onSwitch: (sessionID: string) => void;
  onClose: (sessionID: string) => void;
  onCloseAll: () => void;
}

/** Top tab bar for managing multiple open sessions. */
export function SessionTabs({
  sessions,
  activeSessionID,
  onSwitch,
  onClose,
  onCloseAll,
}: SessionTabsProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the "More Actions" popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  return (
    <div className="session-tabs">
      <div className="tabs-list">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`tab ${session.id === activeSessionID ? 'active' : ''}`}
            onClick={() => onSwitch(session.id)}
            title={session.title || 'Untitled'}
          >
            <span className="tab-title">{session.title || 'Untitled'}</span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onClose(session.id);
              }}
              title="Close Session"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="tabs-actions">
        <div className="more-menu-container" ref={menuRef}>
          <button
            className="more-button"
            onClick={() => setShowMenu(!showMenu)}
            title="More Actions"
          >
            ...
          </button>
          {showMenu && (
            <div className="more-menu-popover">
              <div className="popover-group">
                <div className="popover-group-header">Switch Session</div>
                <div className="popover-options-list">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className={`popover-option ${s.id === activeSessionID ? 'selected' : ''}`}
                      onClick={() => {
                        onSwitch(s.id);
                        setShowMenu(false);
                      }}
                    >
                      <span className="option-text">{s.title || 'Untitled'}</span>
                      {s.id === activeSessionID && <span className="check-icon">✓</span>}
                    </div>
                  ))}
                  {sessions.length === 0 && (
                    <div className="popover-no-results">No open sessions</div>
                  )}
                </div>
              </div>
              <div className="popover-group">
                <div className="popover-group-header">Actions</div>
                <div
                  className="popover-option danger"
                  onClick={() => {
                    onCloseAll();
                    setShowMenu(false);
                  }}
                >
                  Close All Sessions
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
