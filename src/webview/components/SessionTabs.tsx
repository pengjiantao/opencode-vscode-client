/**
 * @file Tab bar showing open sessions with switch, close, and more-actions menu.
 */

import type { Session } from '@opencode-ai/sdk/v2/client';
import { useEffect, useRef, useState } from 'react';
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
}

/**
 * Top tab bar for managing multiple open sessions.
 * Displays horizontal list of sessions and a Popover actions menu.
 */
export function SessionTabs({ sessions, activeSessionID, onSwitch, onClose }: SessionTabsProps) {
  const tabsListRef = useRef<HTMLDivElement>(null);
  const [showMore, setShowMore] = useState(false);
  const prevActiveSessionIDRef = useRef(activeSessionID);

  useEffect(() => {
    if (!activeSessionID) {
      return;
    }
    // Only scroll when the active session actually changes (user switched tabs),
    // not when the sessions list changes (e.g. closing a non-active tab).
    if (prevActiveSessionIDRef.current === activeSessionID) {
      return;
    }
    prevActiveSessionIDRef.current = activeSessionID;

    // Query the active tab element within our list and scroll it into view.
    // We check typeof scrollIntoView to be safe in non-browser or test contexts.
    const activeTab = tabsListRef.current?.querySelector('.tab.active');
    if (activeTab && typeof activeTab.scrollIntoView === 'function') {
      activeTab.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [activeSessionID, sessions]);

  // Keep track of scroll overflow to show the 'More Actions' menu dynamically.
  // We use ResizeObserver to recheck whenever the tabs list or container sizes change.
  useEffect(() => {
    const tabsList = tabsListRef.current;
    const parent = tabsList?.parentElement;
    if (!tabsList || !parent) {
      return;
    }

    const checkOverflow = () => {
      // scrollWidth is total width of all tabs.
      // parent.clientWidth is the available width inside the tabs bar container.
      setShowMore(tabsList.scrollWidth > parent.clientWidth);
    };

    // Initial check on mount/render
    checkOverflow();

    const resizeObserver = new ResizeObserver(() => {
      checkOverflow();
    });
    resizeObserver.observe(parent);

    return () => {
      resizeObserver.disconnect();
    };
  }, [sessions]);

  return (
    <div className="session-tabs">
      <div
        ref={tabsListRef}
        className="tabs-list"
        onWheel={(e) => {
          // Translate vertical scroll into horizontal scroll for tab overflow
          e.currentTarget.scrollLeft += e.deltaY;
        }}
      >
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

      {showMore && (
        <div className="tabs-actions">
          <Popover
            placement="bottom"
            popoverClassName="more-menu-popover-container"
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
                        <span className="option-text" data-custom-title={s.title || 'Untitled'}>
                          {s.title || 'Untitled'}
                        </span>
                        {s.id === activeSessionID && <span className="check-icon">✓</span>}
                      </div>
                    ))}
                    {sessions.length === 0 && (
                      <div className="popover-no-results">No open sessions</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Popover>
        </div>
      )}
    </div>
  );
}
