/**
 * @file Renders a text message part with optional streaming indicator.
 */

import { Markdown } from '../Markdown';

interface TextPartProps {
  text: string;
  streaming?: boolean;
}

/** Displays text content with a shimmer/animation when streaming. */
export function TextPart({ text, streaming = false }: TextPartProps) {
  return (
    <div className={`part text-part ${streaming ? 'streaming' : ''}`}>
      <div className="markdown-content">
        <Markdown text={text} />
      </div>
    </div>
  );
}
