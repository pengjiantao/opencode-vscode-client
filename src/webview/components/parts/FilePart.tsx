/**
 * @file FilePart component rendering file and image attachments in the chat history.
 * Delegates rendering to the interactive Chip component for consistent design,
 * tooltips, and open file actions.
 */

import type { FilePart as SDKFilePart } from '@opencode-ai/sdk/v2/client';
import { parseFilenameLineRange, parseFileUrl } from '../../utils/chipUtils';
import { Chip } from '../Chip';

interface FilePartProps {
  /** The message part to render. */
  part: SDKFilePart;
}

/** Renders a file/image attachment part in the chat history using a Chip. */
export function FilePart({ part }: FilePartProps) {
  const { filename, mime, url } = part;
  const isImage = mime?.startsWith('image/') || url?.startsWith('data:image/');
  const filenameRange = parseFilenameLineRange(filename);

  let chipType: 'file' | 'image' | 'code-selection' | 'terminal' = 'file';
  if (isImage) {
    chipType = 'image';
  } else if (
    filename?.startsWith('terminal [') ||
    (part.source &&
      (part.source.type === 'file' || part.source.type === 'symbol') &&
      part.source.path.startsWith('terminal-'))
  ) {
    chipType = 'terminal';
  } else if (mime !== 'directory' && mime !== 'application/x-directory' && filenameRange) {
    chipType = 'code-selection';
  }

  // Extract absolute path from file:// scheme if present, or use the source path
  let path: string | undefined =
    part.source && (part.source.type === 'file' || part.source.type === 'symbol')
      ? part.source.path
      : undefined;
  let text: string | undefined;

  if (chipType === 'file' && url) {
    const parsed = parseFileUrl(url, mime);
    path = path || parsed.path;
    text = parsed.text;
  } else if (url) {
    const parsed = parseFileUrl(url, mime);
    text = parsed.text;
  }

  if (!text && part.source && part.source.type === 'file' && part.source.text) {
    text = part.source.text.value;
  }

  const dataUrl = isImage ? url : undefined;

  let startLine: number | undefined;
  let endLine: number | undefined;
  let linesCount: number | undefined;

  if (chipType === 'code-selection') {
    startLine = filenameRange?.startLine;
    endLine = filenameRange?.endLine;
    if (part.source && part.source.type === 'file' && part.source.text) {
      startLine = startLine ?? part.source.text.start;
      endLine = endLine ?? part.source.text.end;
    }
  } else if (
    chipType === 'terminal' &&
    part.source &&
    part.source.type === 'file' &&
    part.source.text
  ) {
    linesCount = part.source.text.end;
  }

  return (
    <div className="part file-part-wrapper" style={{ display: 'inline-block', margin: '4px 0' }}>
      <Chip
        type={chipType}
        filename={filename}
        path={path}
        mime={mime}
        dataUrl={dataUrl}
        text={text}
        linesCount={linesCount}
        startLine={startLine}
        endLine={endLine}
      />
    </div>
  );
}
