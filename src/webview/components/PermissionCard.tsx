interface PermissionCardProps {
  id: string;
  type: string;
  title: string;
  metadata: Record<string, unknown>;
  onReply: (id: string, allow: boolean) => void;
}

export function PermissionCard({ id, type, title, metadata, onReply }: PermissionCardProps) {
  return (
    <div className="permission-card">
      <div className="permission-header">
        <span className="permission-icon">$(shield)</span>
        <span className="permission-title">{title}</span>
      </div>
      <div className="permission-body">
        <p className="permission-type">Type: {type}</p>
        {metadata && <pre className="permission-metadata">{JSON.stringify(metadata, null, 2)}</pre>}
      </div>
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
