/**
 * @file Maps file extensions to VS Code Codicon names for language-specific icons.
 */

/** Returns the Codicon name for a given file path based on its extension. */
export function getFileIcon(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
    case 'php':
      return 'symbol-method';
    case 'json':
      return 'symbol-object';
    case 'css':
    case 'scss':
    case 'less':
      return 'symbol-color';
    case 'html':
    case 'htm':
    case 'xml':
      return 'symbol-interface';
    case 'md':
    case 'mdx':
      return 'markdown';
    case 'py':
    case 'rb':
      return 'symbol-string';
    case 'rs':
      return 'symbol-struct';
    case 'go':
      return 'symbol-package';
    case 'java':
    case 'kt':
      return 'symbol-class';
    case 'c':
    case 'cpp':
    case 'h':
    case 'hpp':
      return 'symbol-keyword';
    case 'swift':
      return 'symbol-enum';
    case 'sql':
      return 'database';
    case 'yaml':
    case 'yml':
    case 'toml':
    case 'ini':
      return 'settings';
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'fish':
      return 'terminal';
    case 'svg':
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
      return 'file-media';
    case 'lock':
      return 'lock';
    default:
      return 'file';
  }
}

/** Extracts the filename from a file path. */
export function getFilename(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] ?? filePath;
}

/** Extracts the directory path (without filename) from a file path. */
export function getDirectory(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  parts.pop();
  return parts.join('/');
}
