/**
 * @file Compact, single-line permission request bar.
 * Placed between ChatView and PromptInput to display pending session permissions.
 */

import { useSessionStore } from '../store/sessionStore';
import { Codicon } from './Codicon';

interface PermissionBarProps {
  /** The currently active session ID to filter permission requests. */
  sessionID: string;
  /** Callback triggered when user replies to a permission request. */
  onReply: (permissionID: string, reply: 'once' | 'always' | 'reject') => void;
}

/**
 * Resolves an appropriate Codicon name based on the permission type.
 *
 * @param permission - The requested permission type identifier.
 * @returns A string conforming to the Codicon component specification.
 */
function getPermissionIcon(permission: string): string {
  const p = permission.toLowerCase();
  if (p.includes('read')) return '$(file-code)';
  if (p.includes('edit') || p.includes('write')) return '$(edit)';
  if (p.includes('external_directory')) return '$(folder)';
  if (p.includes('bash') || p.includes('run_command')) return '$(terminal)';
  if (p.includes('glob') || p.includes('grep')) return '$(search)';
  if (p.includes('list')) return '$(list-unordered)';
  if (p.includes('task')) return '$(checklist)';
  if (p.includes('web')) return '$(globe)';
  return '$(shield)';
}

/**
 * Summarizes the permission request and its key metadata arguments into a brief sentence.
 *
 * @param permission - The requested permission identifier.
 * @param metadata - Structured parameters associated with the request.
 * @returns A user-friendly summarized string.
 */
function getPermissionSummary(permission: string, metadata: Record<string, unknown>): string {
  const p = permission.toLowerCase();

  // Extract common metadata fields
  const filePath = (metadata.filepath || metadata.filePath || metadata.path || '') as string;
  const dirPath = (metadata.path || metadata.dir || metadata.dirPath || '') as string;
  const command = (metadata.command || '') as string;
  const pattern = (metadata.pattern || '') as string;
  const url = (metadata.url || '') as string;
  const query = (metadata.query || '') as string;
  const description = (metadata.description || metadata.desc || '') as string;

  if (p === 'external_directory') {
    return `Access external directory ${dirPath || filePath || '/'}`;
  }
  if (p === 'bash' || p === 'run_command') {
    return `Execute command ${command}`;
  }
  if (p === 'edit' || p === 'write_file' || p === 'write') {
    return `Edit file ${filePath}`;
  }
  if (p === 'read' || p === 'read_file') {
    return `Read file ${filePath}`;
  }
  if (p === 'glob') {
    return `Search files matching ${pattern}`;
  }
  if (p === 'grep') {
    return `Search content for ${pattern}`;
  }
  if (p === 'list' || p === 'list_directory') {
    return `List directory ${dirPath}`;
  }
  if (p === 'task') {
    return `Execute subtask ${description}`;
  }
  if (p === 'webfetch') {
    return `Fetch URL ${url}`;
  }
  if (p === 'websearch') {
    return `Search web for ${query}`;
  }

  return `Request ${permission} permission`;
}

/** Renders a scrollable container listing compact permission request rows. */
export function PermissionBar({ sessionID, onReply }: PermissionBarProps) {
  const pendingPermissions = useSessionStore((s) => s.pendingPermissions);
  const removePendingPermission = useSessionStore((s) => s.removePendingPermission);

  const activePermissions = pendingPermissions.filter((p) => p.sessionID === sessionID);

  if (activePermissions.length === 0) {
    return null;
  }

  const handleAction = (id: string, reply: 'once' | 'always' | 'reject') => {
    onReply(id, reply);
    removePendingPermission(id);
  };

  return (
    <div className="permission-bar-container">
      {activePermissions.map((perm) => {
        const summary = getPermissionSummary(perm.permission, perm.metadata);
        return (
          <div key={perm.id} className="permission-bar-row">
            <div className="permission-bar-left">
              <Codicon name={getPermissionIcon(perm.permission)} className="permission-bar-icon" />
              <span className="permission-bar-text" data-custom-title={summary}>
                {summary}
              </span>
            </div>
            <div className="permission-bar-actions">
              <button
                className="permission-bar-btn permission-bar-btn-always"
                onClick={() => handleAction(perm.id, 'always')}
                data-custom-title="Always allow this tool and arguments"
              >
                Always Allow
              </button>
              <button
                className="permission-bar-btn permission-bar-btn-allow"
                onClick={() => handleAction(perm.id, 'once')}
                data-custom-title="Allow this execution"
              >
                Allow
              </button>
              <button
                className="permission-bar-btn permission-bar-btn-deny"
                onClick={() => handleAction(perm.id, 'reject')}
                data-custom-title="Deny this execution"
              >
                Deny
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
