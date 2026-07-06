/**
 * @file Clipboard attachment parsing utilities for prompt editor paste handling.
 * Converts browser clipboard data into editor actions without mutating the DOM.
 */

import {
  basenameOf,
  formatMarkdownFileReference,
  getAttachmentMimeType,
  normalizeClipboardPath,
  parseClipboardPathList,
  shouldUseMarkdownPathReference,
} from '../../shared/utils';

/** Action describing an image file that should be read as a data URL. */
export interface ClipboardImageFileAction {
  /** Discriminator for image file paste actions. */
  type: 'image-file';
  /** Browser File object to be read by the prompt editor. */
  file: File;
  /** Display name shown in the inserted image chip. */
  filename: string;
  /** File size in bytes reported by the clipboard API. */
  size: number;
  /** Image MIME type reported by the clipboard API. */
  mime: string;
}

/** Action describing a text-readable file chip with a resolved path. */
export interface ClipboardFileChipAction {
  /** Discriminator for path-backed file chip actions. */
  type: 'file-chip';
  /** Display name shown in the inserted file chip. */
  filename: string;
  /** Absolute or workspace-resolved path stored on the file chip. */
  path: string;
  /** File size in bytes when available from the clipboard API. */
  size?: number;
  /** MIME type used when serializing the file chip into a prompt part. */
  mime: string;
}

/** Action describing a Markdown file path reference to insert as plain text. */
export interface ClipboardMarkdownReferenceAction {
  /** Discriminator for plain-text Markdown file reference actions. */
  type: 'markdown-reference';
  /** Complete Markdown link text to insert into the editor. */
  text: string;
}

/** Action describing a text-readable clipboard file without an exposed path. */
export interface ClipboardTextFileAction {
  /** Discriminator for clipboard files that must be read as text. */
  type: 'text-file';
  /** Browser File object whose text content should be read. */
  file: File;
  /** Display name shown in the inserted file chip. */
  filename: string;
  /** File size in bytes reported by the clipboard API. */
  size: number;
  /** Text-like MIME type used for the inserted file chip. */
  mime: string;
}

/** Action describing plain pasted text that should become a text chip. */
export interface ClipboardTextChipAction {
  /** Discriminator for ordinary plain-text paste actions. */
  type: 'text-chip';
  /** Display label shown in the inserted text chip. */
  filename: string;
  /** Plain text captured from the clipboard. */
  text: string;
  /** Number of pasted text lines for chip display and metadata. */
  linesCount: number;
}

/** Action requesting extension-host resolution for clipboard files without exposed paths. */
export interface ClipboardResolveFilePathAction {
  /** Discriminator for async extension-host path resolution requests. */
  type: 'resolve-file-path';
  /** Base filename reported by the browser clipboard API. */
  filename: string;
  /** File size in bytes, used only as a best-effort disambiguation hint. */
  size: number;
  /** MIME type inferred from the filename and browser-provided MIME. */
  mime: string;
}

/** A single operation the prompt editor should perform for a paste event. */
export type ClipboardPasteAction =
  | ClipboardImageFileAction
  | ClipboardFileChipAction
  | ClipboardMarkdownReferenceAction
  | ClipboardTextFileAction
  | ClipboardTextChipAction
  | ClipboardResolveFilePathAction;

/** Parsed clipboard result, including whether the browser default paste should be prevented. */
export interface ClipboardPastePlan {
  /** Whether the editor should prevent the browser's default paste behavior. */
  handled: boolean;
  /** Ordered actions the prompt editor should execute for this paste event. */
  actions: ClipboardPasteAction[];
}

/** Utility class for converting clipboard data into prompt editor paste actions. */
export class ClipboardAttachmentUtils {
  private constructor() {}

  /**
   * Parses a clipboard payload into editor actions.
   *
   * @param data Browser clipboard data from a paste event.
   * @returns A paste plan for the caller to execute.
   */
  static createPastePlan(data: DataTransfer): ClipboardPastePlan {
    const pastedText = this.getClipboardText(data, 'text/plain')?.trim();
    const pastedPath = pastedText ? normalizeClipboardPath(pastedText) : undefined;
    const clipboardPaths = this.getClipboardFilePaths(data);

    if (data.files && data.files.length > 0) {
      const actions = Array.from(data.files).map((file, index) =>
        this.createFilePasteAction(file, clipboardPaths, index, pastedPath),
      );
      return { handled: actions.length > 0, actions };
    }

    if (!pastedText) {
      return { handled: false, actions: [] };
    }

    if (pastedPath) {
      const resolvedMime = getAttachmentMimeType(pastedPath);
      const filename = basenameOf(pastedPath) || 'file';
      if (shouldUseMarkdownPathReference(resolvedMime)) {
        return {
          handled: true,
          actions: [this.markdownReferenceAction(filename, pastedPath)],
        };
      }
      return {
        handled: true,
        actions: [
          {
            type: 'file-chip',
            path: pastedPath,
            filename,
            mime: resolvedMime,
          },
        ],
      };
    }

    const linesCount = pastedText.split(/\r?\n/).length;
    return {
      handled: true,
      actions: [
        {
          type: 'text-chip',
          filename: `Pasted ${linesCount} Lines`,
          text: pastedText,
          linesCount,
        },
      ],
    };
  }

  /**
   * Converts a pasted browser File into the editor action that preserves its usable data.
   *
   * @param file File object reported by the browser paste event.
   * @param clipboardPaths Local paths parsed from accompanying clipboard formats.
   * @param index File index used to pair file-manager paths with DataTransfer files.
   * @param pastedPath Single path parsed from plain text, used when no indexed path exists.
   * @returns The action the prompt editor should execute for this file.
   */
  private static createFilePasteAction(
    file: File,
    clipboardPaths: readonly string[],
    index: number,
    pastedPath: string | undefined,
  ): ClipboardPasteAction {
    if (file.type.startsWith('image/')) {
      return {
        type: 'image-file',
        file,
        filename: file.name || 'Pasted Image',
        size: file.size,
        mime: file.type,
      };
    }

    const resolvedPath = this.resolveClipboardFilePath(file, clipboardPaths, index, pastedPath);
    const resolvedMime = this.getPastedFileMime(file, resolvedPath);

    if (resolvedPath) {
      const filename = this.getAttachmentFilename(file.name, resolvedPath);
      if (shouldUseMarkdownPathReference(resolvedMime)) {
        return this.markdownReferenceAction(filename, resolvedPath);
      }
      return {
        type: 'file-chip',
        path: resolvedPath,
        filename,
        size: file.size,
        mime: resolvedMime,
      };
    }

    const filename = file.name || 'file';
    if (shouldUseMarkdownPathReference(resolvedMime)) {
      return {
        type: 'resolve-file-path',
        filename,
        size: file.size,
        mime: resolvedMime,
      };
    }

    return {
      type: 'text-file',
      file,
      filename,
      size: file.size,
      mime: resolvedMime,
    };
  }

  /**
   * Safely reads a clipboard string format.
   *
   * @param data Clipboard data from the paste event.
   * @param format MIME-like clipboard format name to read.
   * @returns The clipboard string for that format, or an empty string when unavailable.
   */
  private static getClipboardText(data: DataTransfer, format: string): string {
    try {
      return data.getData(format);
    } catch {
      return '';
    }
  }

  /**
   * Extracts local file paths from clipboard formats used by common desktop file managers.
   *
   * @param data Clipboard data from the paste event.
   * @returns Unique local file paths, preferring explicit URI-list formats over plain text.
   */
  private static getClipboardFilePaths(data: DataTransfer): string[] {
    const uriPaths = parseClipboardPathList(this.getClipboardText(data, 'text/uri-list'));
    if (uriPaths.length > 0) return uriPaths;

    const gnomePaths = parseClipboardPathList(
      this.getClipboardText(data, 'x-special/gnome-copied-files'),
    );
    if (gnomePaths.length > 0) return gnomePaths;

    return parseClipboardPathList(this.getClipboardText(data, 'text/plain'));
  }

  /**
   * Resolves the best local path for a browser clipboard File.
   *
   * @param file File object reported by the browser paste event.
   * @param clipboardPaths Paths parsed from accompanying clipboard text formats.
   * @param index File index used when file manager path order matches DataTransfer order.
   * @param pastedPath Single path parsed from plain text, used as a final fallback.
   * @returns A local file path when the browser or clipboard exposes one.
   */
  private static resolveClipboardFilePath(
    file: File,
    clipboardPaths: readonly string[],
    index: number,
    pastedPath: string | undefined,
  ): string | undefined {
    const fileWithNativePath = file as File & { path?: string; webkitRelativePath?: string };
    const nativePath =
      normalizeClipboardPath(fileWithNativePath.path ?? '') ??
      normalizeClipboardPath(fileWithNativePath.webkitRelativePath ?? '');
    if (nativePath) return nativePath;

    const matchingPath = clipboardPaths.find((path) => basenameOf(path) === file.name);
    if (matchingPath) return matchingPath;

    return clipboardPaths[index] ?? (clipboardPaths.length === 1 ? clipboardPaths[0] : pastedPath);
  }

  /**
   * Chooses the MIME type for a pasted file using path-based inference first.
   *
   * @param file File object reported by the browser paste event.
   * @param filePath Resolved path, when available.
   * @returns MIME type used for deciding chip vs Markdown reference behavior.
   */
  private static getPastedFileMime(file: File, filePath?: string): string {
    return getAttachmentMimeType(filePath || file.name, file.type);
  }

  /**
   * Chooses a stable display filename for a file attachment action.
   *
   * @param fileName Browser-reported filename, when available.
   * @param filePath Resolved path used as a fallback source.
   * @returns Filename shown in chips or Markdown labels.
   */
  private static getAttachmentFilename(fileName: string | undefined, filePath: string): string {
    return fileName || basenameOf(filePath) || 'file';
  }

  /**
   * Builds a Markdown file reference action for non-text, non-image attachments.
   *
   * @param filename Visible Markdown link label.
   * @param filePath Absolute file path or path token to reference.
   * @returns Paste action that inserts the formatted Markdown link.
   */
  private static markdownReferenceAction(
    filename: string,
    filePath: string,
  ): ClipboardMarkdownReferenceAction {
    return {
      type: 'markdown-reference',
      text: `${formatMarkdownFileReference(filename, filePath)}\n`,
    };
  }
}
