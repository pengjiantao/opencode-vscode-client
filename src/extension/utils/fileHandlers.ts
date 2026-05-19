/**
 * @file File handlers and path resolution utilities for the VS Code extension host.
 * Provides functions to resolve absolute/relative/home paths, query file stats/content,
 * and open files inside the active VS Code workspace.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Uri, window, workspace } from 'vscode';
import type { IPCBridge } from '../ipc';

/**
 * Resolves a given path string to a canonical absolute file path.
 * Handles `file://` schemes, home directories prefixed with `~`,
 * absolute paths, and relative paths (resolved against the first workspace folder).
 *
 * @param filePath The raw path string from the webview or API.
 * @returns The resolved absolute canonical file path.
 */
export function resolveFilePath(filePath: string): string {
  let resolved = filePath;

  // Handle standard file:// URLs by converting them to filesystem paths
  if (filePath.startsWith('file://')) {
    resolved = Uri.parse(filePath).fsPath;
  }
  // Expand home directory shorthand (~) to the user's OS home folder
  else if (filePath.startsWith('~')) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    resolved = filePath.replace('~', homeDir);
  }
  // Resolve relative paths relative to the active workspace root directory if available
  else if (
    !path.isAbsolute(resolved) &&
    workspace.workspaceFolders &&
    workspace.workspaceFolders.length > 0
  ) {
    resolved = path.resolve(workspace.workspaceFolders[0].uri.fsPath, resolved);
  }

  return resolved;
}

/**
 * Registers IPC event handlers for file operations:
 * - `file:open`: Opens a workspace file in the VS Code editor.
 * - `file:query`: Queries metadata (existence, size, content preview, isWorkspace status) for a file.
 *
 * @param ipc The extension's IPC bridge instance.
 */
export function registerFileHandlers(ipc: IPCBridge): void {
  // IPC command to open a file in VS Code editor
  ipc.on('file:open', (msg) => {
    const { path: filePath } = msg as { path: string };
    try {
      const resolvedPath = resolveFilePath(filePath);
      const uri = Uri.file(resolvedPath);

      // Verify the file belongs to the current workspace to restrict editor opening
      const isWorkspace = !!workspace.getWorkspaceFolder(uri);
      if (!isWorkspace) {
        window.showWarningMessage('Refusing to open file outside the active workspace.');
        return;
      }

      workspace.openTextDocument(uri).then(
        (doc) => {
          window.showTextDocument(doc);
        },
        (err) => {
          window.showErrorMessage(`Failed to open document: ${(err as Error).message}`);
        },
      );
    } catch (err) {
      window.showErrorMessage(`Failed to open file: ${(err as Error).message}`);
    }
  });

  // IPC command to query file metadata (existence, size, content, workspace membership)
  ipc.on('file:query', async (msg) => {
    const { path: filePath } = msg as { path: string };
    try {
      const resolvedPath = resolveFilePath(filePath);

      let stat: fs.Stats;
      try {
        stat = await fs.promises.stat(resolvedPath);
      } catch {
        ipc.send({
          type: 'file:query-response',
          path: filePath,
          exists: false,
          filename: '',
          size: 0,
          isWorkspace: false,
        });
        return;
      }

      const isFile = stat.isFile();
      if (!isFile) {
        ipc.send({
          type: 'file:query-response',
          path: filePath,
          exists: false,
          filename: '',
          size: 0,
          isWorkspace: false,
        });
        return;
      }

      const filename = resolvedPath.split(/[\\/]/).pop() || '';
      const size = stat.size;

      // Use the canonical VS Code API to determine workspace membership
      const uri = Uri.file(resolvedPath);
      const isWorkspace = !!workspace.getWorkspaceFolder(uri);

      let content: string | undefined;
      const limit = 30 * 1024; // Limit preview extraction to files smaller than 30KB
      // Defense-in-depth: limit file reading to workspace files only
      if (isWorkspace && size <= limit) {
        try {
          const buffer = await fs.promises.readFile(resolvedPath);
          // Exclude binary files containing null bytes
          const isText = !buffer.includes(0);
          if (isText) {
            content = buffer.toString('utf-8');
          }
        } catch (readErr) {
          console.error('Error reading file content:', readErr);
        }
      }

      ipc.send({
        type: 'file:query-response',
        path: filePath,
        exists: true,
        filename,
        size,
        content,
        isWorkspace,
      });
    } catch (err) {
      console.error('Error querying file:', err);
      ipc.send({
        type: 'file:query-response',
        path: filePath,
        exists: false,
        filename: '',
        size: 0,
        isWorkspace: false,
      });
    }
  });
}
