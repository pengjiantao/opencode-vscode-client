/**
 * @file Tab bar showing open sessions with switch, close, and more-actions menu.
 */

import type { Session } from '@opencode-ai/sdk';
import { IconButton } from './IconButton';
import { Popover } from './Popover';

/** Props for the SessionTabs component. */
export interface SessionTabsProps {
  /** Array of active session models. */
  sessions: Session[];
  /** Currently active session identifier. */
  activeSessionID: string | null;
  /** Callback fired when a tab is selected/clicked. */
  onSwitch: (sessionID: string) => void;
  /** Callback fired when the close button on a specific tab is clicked. */
  onClose: (sessionID: string) => void;
  /** Callback fired when 'Close All Sessions' action is clicked. */
  onCloseAll: () => void;
}

/**
 * Top tab bar for managing multiple open sessions.
 * Displays horizontal list of sessions and a Popover actions menu.
 */
export function SessionTabs({
  sessions,
  activeSessionID,
  onSwitch,
  onClose,
  onCloseAll,
}: SessionTabsProps) {
  return (
    <div className="session-tabs">
      <div className="tabs-list">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`tab ${session.id === activeSessionID ? 'active' : ''}`}
            onClick={() => onSwitch(session.id)}
            data-custom-title={session.title || 'Untitled'}
          >
            <span className="tab-title">{session.title || 'Untitled'}</span>
            <IconButton
              className="tab-close"
              name="close"
              size="small"
              title="Close Session"
              onClick={(e) => {
                // Prevent bubbling to tab activation click handler
                e.stopPropagation();
                onClose(session.id);
              }}
            />
          </div>
        ))}
      </div>

      <div className="tabs-actions">
        <Popover
          placement="bottom"
          trigger={<IconButton name="ellipsis" title="More Actions" size="medium" />}
        >
          {({ close }) => (
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
                        close();
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
                    close();
                  }}
                >
                  Close All Sessions
                </div>
              </div>
            </div>
          )}
        </Popover>
      </div>
    </div>
  );
}
