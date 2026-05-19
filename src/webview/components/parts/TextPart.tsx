/**
 * @file Renders a text message part with optional streaming indicator.
 */

import type { Part } from '@opencode-ai/sdk/v2/client';
import { Markdown } from '../Markdown';

interface TextPartProps {
  text: string;
  streaming?: boolean;
  allParts?: Part[];
}

/** Displays text content with a shimmer/animation when streaming. */
export function TextPart({ text, streaming = false, allParts }: TextPartProps) {
  return (
    <div className={`part text-part ${streaming ? 'streaming' : ''}`}>
      <div className="markdown-content">
        <Markdown text={text} allParts={allParts} />
      </div>
    </div>
  );
}
