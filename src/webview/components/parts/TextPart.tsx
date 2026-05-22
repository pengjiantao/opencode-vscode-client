/**
 * @file Renders a text message part.
 */

import type { Part } from '@opencode-ai/sdk/v2/client';
import { Markdown } from '../Markdown';

interface TextPartProps {
  /** The text content to display, which may contain Markdown. */
  text: string;
  /** All message parts in the current turn, used for context. */
  allParts?: Part[];
}

/** Displays static or streamed Markdown text content. */
export function TextPart({ text, allParts }: TextPartProps) {
  return (
    <div className="part text-part">
      <div className="markdown-content">
        <Markdown text={text} allParts={allParts} />
      </div>
    </div>
  );
}
