/**
 * @file File handlers and path resolution utilities for the VS Code extension host.
 * Provides functions to resolve absolute/relative/home paths, query file stats/content,
 * and open files inside the active VS Code workspace.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Position, Range, Selection, Uri, commands, window, workspace } from 'vscode';
import { getMimeType } from '../../shared/utils';
import type { IPCBridge } from '../ipc';
import type { SDKClient } from '../sdk-client';
import type { SelectedFileInfo, WorkspaceSearchResult } from '../types';

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
 * - `workspace:search-files`: Searches the workspace for files and directories matching a query via the opencode SDK.
 *
 * @param ipc The extension's IPC bridge instance.
 * @param sdkClient The SDK client for opencode server communication.
 */
export function registerFileHandlers(ipc: IPCBridge, sdkClient: SDKClient): void {
  // IPC command to open a file in VS Code editor
  ipc.on('file:open', (msg) => {
    const {
      path: filePath,
      startLine,
      endLine,
    } = msg as { path: string; startLine?: number; endLine?: number };
    try {
      const resolvedPath = resolveFilePath(filePath);
      const uri = Uri.file(resolvedPath);

      // Verify the file belongs to the current workspace to restrict editor opening
      const isWorkspace = !!workspace.getWorkspaceFolder(uri);
      if (!isWorkspace) {
        window.showWarningMessage('Refusing to open file outside the active workspace.');
        return;
      }

      // If the path represents a directory, opening it as a text document would fail.
      // Instead, we reveal the directory in the native VS Code Explorer panel.
      const stat = fs.statSync(resolvedPath);
      if (stat.isDirectory()) {
        commands.executeCommand('revealInExplorer', uri);
        return;
      }

      workspace.openTextDocument(uri).then(
        (doc) => {
          window.showTextDocument(doc).then((editor) => {
            // Position cursor and reveal line. If endLine is provided, select the full range (e.g. for added lines).
            if (startLine !== undefined) {
              const startPos = new Position(startLine - 1, 0);
              if (endLine !== undefined) {
                const endPos = new Position(endLine - 1, doc.lineAt(endLine - 1).text.length);
                editor.selection = new Selection(startPos, endPos);
                editor.revealRange(new Range(startPos, endPos));
              } else {
                editor.selection = new Selection(startPos, startPos);
                editor.revealRange(new Range(startPos, startPos));
              }
            }
          });
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
  ipc.on('file:query', (msg) => {
    const { path: filePath } = msg as { path: string };
    void (async () => {
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
        const isDir = stat.isDirectory();
        // Skip paths that are neither files nor directories (e.g. symlinks, named pipes)
        if (!isFile && !isDir) {
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
        const size = isDir ? 0 : stat.size;

        // Use the canonical VS Code API to determine workspace membership
        const uri = Uri.file(resolvedPath);
        const isWorkspace = !!workspace.getWorkspaceFolder(uri);

        let content: string | undefined;
        // Only attempt reading contents for physical text files, not directories
        if (isFile) {
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
    })();
  });

  // IPC command to search workspace files/directories via the opencode SDK
  ipc.on('workspace:search-files', (msg) => {
    const { query } = msg as { query: string };
    void (async () => {
      try {
        const workspaceRoot = workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
        const paths = await sdkClient.find.files(query, 50);
        const resolved = paths.map((p) => ({
          p,
          fsPath: path.resolve(workspaceRoot, p),
        }));
        const stats = await Promise.all(
          resolved.map(({ fsPath }) => fs.promises.stat(fsPath).catch(() => null)),
        );
        const results: WorkspaceSearchResult[] = resolved.map(({ p, fsPath }, i) => ({
          name: path.basename(p),
          relativePath: p,
          type: stats[i]?.isDirectory() ? 'dir' : 'file',
          fsPath,
        }));
        ipc.send({ type: 'workspace:search-files-response', query, results });
      } catch (err) {
        console.error('Error searching workspace files:', err);
        ipc.send({ type: 'workspace:search-files-response', query, results: [] });
      }
    })();
  });

  // IPC command to select local files/images
  ipc.on('file:select', () => {
    return (async () => {
      try {
        const uris = await window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: true,
          openLabel: 'Select Files/Images',
          title: 'Select Files/Images to Reference',
        });

        if (!uris || uris.length === 0) {
          return;
        }

        const filesInfo: SelectedFileInfo[] = [];
        for (const uri of uris) {
          const fsPath = uri.fsPath;
          const stat = await fs.promises.stat(fsPath);
          const name = path.basename(fsPath);
          const size = stat.size;

          const mime = getMimeType(name);
          let dataUrl: string | undefined;

          if (mime.startsWith('image/')) {
            if (size > 10 * 1024 * 1024) {
              void window.showErrorMessage(`Image "${name}" exceeds the 10MB size limit.`);
              continue;
            }
            try {
              const buffer = await fs.promises.readFile(fsPath);
              dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
            } catch (readErr) {
              console.error(`Failed to read image file ${fsPath}:`, readErr);
            }
          }

          filesInfo.push({
            name,
            fsPath,
            size,
            mime,
            dataUrl,
          });
        }

        ipc.send({
          type: 'file:selected',
          files: filesInfo,
        });
      } catch (err) {
        console.error('Error selecting local files:', err);
        window.showErrorMessage(`Failed to select files: ${(err as Error).message}`);
      }
    })();
  });
}
