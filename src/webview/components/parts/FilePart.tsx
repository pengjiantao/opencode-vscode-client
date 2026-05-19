/**
 * @file FilePart component rendering file and image attachments in the chat history.
 * Delegates rendering to the interactive Chip component for consistent design,
 * tooltips, and open file actions.
 */

import { parseFileUrl } from '../../utils/chipUtils';
import { Chip } from '../Chip';

interface FilePartProps {
  /** Display name of the file. */
  filename?: string;
  /** MIME type of the attachment. */
  mime: string;
  /** Direct URL (file:// path or base64 data URL) of the attachment. */
  url: string;
  /** Optional resolved local file path. */
  path?: string;
}

/** Renders a file/image attachment part in the chat history using a Chip. */
export function FilePart({ filename, mime, url, path: passedPath }: FilePartProps) {
  const isImage = mime?.startsWith('image/') || url?.startsWith('data:image/');
  const chipType = isImage ? 'image' : 'file';

  // Extract absolute path from file:// scheme if present, or use the passed path
  let path: string | undefined = passedPath;
  let text: string | undefined;
  if (chipType === 'file' && url) {
    const parsed = parseFileUrl(url, mime);
    path = passedPath || parsed.path;
    text = parsed.text;
  }

  const dataUrl = isImage ? url : undefined;

  return (
    <div className="part file-part-wrapper" style={{ display: 'inline-block', margin: '4px 0' }}>
      <Chip
        type={chipType}
        filename={filename}
        path={path}
        mime={mime}
        dataUrl={dataUrl}
        text={text}
      />
    </div>
  );
}
