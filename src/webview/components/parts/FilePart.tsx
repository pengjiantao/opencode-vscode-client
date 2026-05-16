interface FilePartProps {
  filename?: string;
  mime: string;
  url: string;
}

export function FilePart({ filename, mime }: FilePartProps) {
  const getFileIcon = () => {
    if (mime.startsWith('image/')) return '$(file-media)';
    if (mime.startsWith('text/')) return '$(file-text)';
    if (mime === 'application/pdf') return '$(file-pdf)';
    if (mime === 'directory') return '$(folder)';
    return '$(file)';
  };

  return (
    <div className="part file-part">
      <span className="file-icon">{getFileIcon()}</span>
      <span className="file-name">{filename || 'file'}</span>
      <span className="file-badge">{mime}</span>
    </div>
  );
}
