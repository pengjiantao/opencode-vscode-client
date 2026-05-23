/**
 * @file File handlers and path resolution utilities for the VS Code extension host.
 * Provides functions to resolve absolute/relative/home paths, query file stats/content,
 * and open files inside the active VS Code workspace.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  Position,
  Range,
  RelativePattern,
  Selection,
  Uri,
  commands,
  window,
  workspace,
} from 'vscode';
import { getMimeType } from '../../shared/utils';
import type { IPCBridge } from '../ipc';
import type { SelectedFileInfo, WorkspaceSearchResult } from '../types';
import { getConfiguration } from './config';
import { isPathIgnored, loadGitignorePatterns } from './gitignore';

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

let cachedWorkspaceItems: WorkspaceSearchResult[] | null = null;
let lastCacheTime = 0;
const CACHE_DURATION = 10000; // 10 seconds

/**
 * Clears the cached workspace items. Primarily used during testing.
 */
export function clearWorkspaceCache(): void {
  cachedWorkspaceItems = null;
  lastCacheTime = 0;
}

/**
 * Rebuilds the cache of all files and directories in the workspace if expired.
 * Filters out common build, version control, and temporary folders as well as patterns in .gitignore.
 *
 * @returns A promise resolving to the list of all workspace items.
 */
async function getWorkspaceItems(): Promise<WorkspaceSearchResult[]> {
  const now = Date.now();
  if (cachedWorkspaceItems && now - lastCacheTime < CACHE_DURATION) {
    return cachedWorkspaceItems;
  }

  const items: WorkspaceSearchResult[] = [];
  const seenDirs = new Set<string>();
  const config = getConfiguration();

  if (workspace.workspaceFolders) {
    for (const folder of workspace.workspaceFolders) {
      const gitignorePatterns = await loadGitignorePatterns(folder.uri.fsPath);

      // Find files in the workspace (exclude node_modules, build, dist, out, git, etc.)
      const files = await workspace.findFiles(
        new RelativePattern(folder, '**/*'),
        '**/{node_modules,.git,dist,build,out,.gemini}/**',
        config.maxCacheFiles,
      );

      for (const file of files) {
        const fsPath = file.fsPath;
        const relativePath = path.relative(folder.uri.fsPath, fsPath).replace(/\\/g, '/');

        // Skip ignored files and subdirectories
        const isIgnored = isPathIgnored(relativePath, false, gitignorePatterns);
        if (isIgnored) {
          continue;
        }

        const name = path.basename(fsPath);

        items.push({
          name,
          relativePath,
          type: 'file',
          fsPath,
        });

        // Traverse up the directories
        let dirPath = path.dirname(fsPath);
        while (dirPath !== folder.uri.fsPath && dirPath.startsWith(folder.uri.fsPath)) {
          const dirRelativePath = path.relative(folder.uri.fsPath, dirPath).replace(/\\/g, '/');

          // If a parent folder itself is ignored, stop traversing up
          const isDirIgnored = isPathIgnored(dirRelativePath, true, gitignorePatterns);
          if (isDirIgnored) {
            break;
          }

          if (seenDirs.has(dirPath)) {
            break;
          }
          seenDirs.add(dirPath);

          const dirName = path.basename(dirPath);

          items.push({
            name: dirName,
            relativePath: dirRelativePath,
            type: 'dir',
            fsPath: dirPath,
          });

          dirPath = path.dirname(dirPath);
        }
      }
    }
  }

  cachedWorkspaceItems = items;
  lastCacheTime = now;
  return items;
}

/**
 * Checks if a string fuzzy matches a query.
 * Characters in the query must appear in order in the target text.
 *
 * @param text The target string to check.
 * @param query The search query.
 * @returns True if the text fuzzy matches the query.
 */
function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true;
  const cleanText = text.toLowerCase();
  const cleanQuery = query.toLowerCase();
  let queryIdx = 0;
  for (let i = 0; i < cleanText.length; i++) {
    if (cleanText[i] === cleanQuery[queryIdx]) {
      queryIdx++;
      if (queryIdx === cleanQuery.length) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Filters and sorts workspace items based on a query.
 * Prioritizes exact matches, prefix matches, and substring matches on the filename.
 *
 * @param items The list of workspace items.
 * @param query The search query.
 * @returns A sorted list of matching workspace items.
 */
function sortMatches(items: WorkspaceSearchResult[], query: string): WorkspaceSearchResult[] {
  if (!query) {
    // If query is empty, sort by relativePath length and then alphabetically
    return [...items].sort((a, b) => {
      const depthA = a.relativePath.split('/').length;
      const depthB = b.relativePath.split('/').length;
      if (depthA !== depthB) {
        return depthA - depthB;
      }
      return a.relativePath.localeCompare(b.relativePath);
    });
  }

  const cleanQuery = query.toLowerCase();

  return items
    .filter((item) => fuzzyMatch(item.name, query) || fuzzyMatch(item.relativePath, query))
    .map((item) => {
      let score: number;
      const nameLower = item.name.toLowerCase();
      const pathLower = item.relativePath.toLowerCase();

      if (nameLower === cleanQuery) {
        score = 100; // Exact match on name
      } else if (nameLower.startsWith(cleanQuery)) {
        score = 80; // Prefix match on name
      } else if (nameLower.includes(cleanQuery)) {
        score = 60; // Substring match on name
      } else if (fuzzyMatch(item.name, query)) {
        score = 40; // Fuzzy match on name
      } else if (pathLower.includes(cleanQuery)) {
        score = 20; // Substring match on path
      } else {
        score = 10; // Fuzzy match on path
      }

      return { item, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.item.relativePath.localeCompare(b.item.relativePath);
    })
    .map((x) => x.item);
}

/**
 * Registers IPC event handlers for file operations:
 * - `file:open`: Opens a workspace file in the VS Code editor.
 * - `file:query`: Queries metadata (existence, size, content preview, isWorkspace status) for a file.
 * - `workspace:search-files`: Searches the workspace for files and directories matching a query.
 *
 * @param ipc The extension's IPC bridge instance.
 */
export function registerFileHandlers(ipc: IPCBridge): void {
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

  // IPC command to search workspace files/directories
  ipc.on('workspace:search-files', (msg) => {
    const { query } = msg as { query: string };
    void (async () => {
      try {
        const items = await getWorkspaceItems();
        const sorted = sortMatches(items, query);
        const results = sorted.slice(0, 50);
        ipc.send({
          type: 'workspace:search-files-response',
          query,
          results,
        });
      } catch (err) {
        console.error('Error searching workspace files:', err);
        ipc.send({
          type: 'workspace:search-files-response',
          query,
          results: [],
        });
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
