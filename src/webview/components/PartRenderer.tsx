/**
 * @file Dispatches rendering of a message part to the appropriate sub-component
 * based on the part type (text, tool, reasoning, file, agent, step).
 */

import type { Part } from '@opencode-ai/sdk';
import { Codicon } from './Codicon';
import { FilePart } from './parts/FilePart';
import { ReasoningPart } from './parts/ReasoningPart';
import { TextPart } from './parts/TextPart';
import { ToolPart } from './parts/ToolPart';

interface PartRendererProps {
  part: Part;
  isAssistant?: boolean;
}

/** Routes a Part to its type-specific renderer component. */
export function PartRenderer({ part, isAssistant = false }: PartRendererProps) {
  switch (part.type) {
    case 'text':
      return <TextPart text={part.text} streaming={isAssistant && !part.time?.end} />;

    case 'tool': {
      const state = part.state;
      const title =
        state.status === 'completed'
          ? state.title
          : state.status === 'running'
            ? state.title
            : undefined;
      const time =
        state.status === 'completed' || state.status === 'running' ? state.time : undefined;
      const output = state.status === 'completed' ? state.output : undefined;
      const error = state.status === 'error' ? (state as { error: string }).error : undefined;
      return (
        <ToolPart
          tool={part.tool}
          state={{
            status: state.status,
            input: state.input,
            output,
            title,
            error,
            time,
          }}
        />
      );
    }

    case 'reasoning':
      return <ReasoningPart text={part.text} time={part.time} metadata={part.metadata} />;

    case 'file':
      return <FilePart filename={part.filename} mime={part.mime} url={part.url} />;

    case 'agent':
      return (
        <div className="part agent-part">
          <span className="agent-icon">
            <Codicon name="$(person)" />
          </span>
          <span className="agent-name">{part.name}</span>
        </div>
      );

    case 'step-start':
    case 'step-finish':
      return null;

    default:
      return (
        <div className="part unknown">
          <span>Unknown part type: {(part as Part).type}</span>
        </div>
      );
  }
}
