/**
 * @file Inline permission request card displayed within the chat view.
 * Prompts the user to Allow or Deny an agent's permission request.
 */

import { Codicon } from './Codicon';
import { DiffPart } from './parts/DiffPart';

interface PermissionCardProps {
  /** Unique identifier of the permission request. */
  id: string;
  /** Type of the permission requested (e.g. edit, bash, read). */
  type: string;
  /** Description title of the permission request. */
  title: string;
  /** Structured metadata associated with the permission action. */
  metadata: Record<string, unknown>;
  /** Callback triggered when the user clicks Allow or Deny. */
  onReply: (id: string, allow: boolean) => void;
}

/** Renders a permission request with Allow/Deny buttons and metadata. */
export function PermissionCard({ id, type, title, metadata, onReply }: PermissionCardProps) {
  /**
   * Evaluates the permission type and returns a formatted details view.
   * Prioritizes diff rendering if a file patch is present in metadata.
   */
  const renderPermissionBody = () => {
    // If a diff preview is available in the metadata, prioritize rendering it
    if (metadata?.diff && typeof metadata.diff === 'string') {
      const filepath = (metadata.filepath || '') as string;
      return (
        <div className="permission-details">
          <p className="permission-type" style={{ marginBottom: '8px', fontWeight: 600 }}>
            {filepath ? `Edit: ${filepath}` : 'File Edit Preview'}
          </p>
          <DiffPart diff={metadata.diff} />
        </div>
      );
    }

    // Format specific common permission request types with developer-friendly aesthetics
    switch (type.toLowerCase()) {
      case 'read': {
        const filePath = (metadata?.filePath || metadata?.path || '') as string;
        return (
          <div className="permission-details">
            <p className="permission-type">Type: Read File</p>
            {filePath && <pre className="permission-metadata">Path: {filePath}</pre>}
          </div>
        );
      }
      case 'glob':
      case 'grep': {
        const pattern = (metadata?.pattern || '') as string;
        return (
          <div className="permission-details">
            <p className="permission-type">Type: {type.toUpperCase()} Search</p>
            {pattern && <pre className="permission-metadata">Pattern: "{pattern}"</pre>}
          </div>
        );
      }
      case 'list': {
        const dirPath = (metadata?.path || metadata?.dir || '') as string;
        return (
          <div className="permission-details">
            <p className="permission-type">Type: List Directory</p>
            {dirPath && <pre className="permission-metadata">Path: {dirPath}</pre>}
          </div>
        );
      }
      case 'bash':
      case 'run_command': {
        const command = (metadata?.command || '') as string;
        return (
          <div className="permission-details">
            <p className="permission-type">Type: Execute Terminal Command</p>
            {command && <pre className="permission-metadata">$ {command}</pre>}
          </div>
        );
      }
      case 'task': {
        const desc = (metadata?.description || '') as string;
        const subType = (metadata?.subagent_type || 'General') as string;
        return (
          <div className="permission-details">
            <p className="permission-type">Type: Delegate Subtask ({subType})</p>
            {desc && <pre className="permission-metadata">◉ {desc}</pre>}
          </div>
        );
      }
      case 'webfetch': {
        const url = (metadata?.url || '') as string;
        return (
          <div className="permission-details">
            <p className="permission-type">Type: Web Fetch</p>
            {url && <pre className="permission-metadata">URL: {url}</pre>}
          </div>
        );
      }
      case 'websearch': {
        const query = (metadata?.query || '') as string;
        return (
          <div className="permission-details">
            <p className="permission-type">Type: Web Search</p>
            {query && <pre className="permission-metadata">Query: "{query}"</pre>}
          </div>
        );
      }
      default:
        // General fallback to JSON presentation for less common or custom permissions
        return (
          <div className="permission-details">
            <p className="permission-type">Type: {type}</p>
            {metadata && Object.keys(metadata).length > 0 && (
              <pre className="permission-metadata">{JSON.stringify(metadata, null, 2)}</pre>
            )}
          </div>
        );
    }
  };

  return (
    <div className="permission-card">
      <div className="permission-header">
        <span className="permission-icon">
          <Codicon name="$(shield)" />
        </span>
        <span className="permission-title">{title}</span>
      </div>
      <div className="permission-body">{renderPermissionBody()}</div>
      <div className="permission-actions">
        <button className="permission-deny" onClick={() => onReply(id, false)}>
          Deny
        </button>
        <button className="permission-allow" onClick={() => onReply(id, true)}>
          Allow
        </button>
      </div>
    </div>
  );
}
