import type { Part } from '@opencode-ai/sdk';
import { FilePart } from './parts/FilePart';
import { ReasoningPart } from './parts/ReasoningPart';
import { TextPart } from './parts/TextPart';
import { ToolPart } from './parts/ToolPart';

interface PartRendererProps {
  part: Part;
}

export function PartRenderer({ part }: PartRendererProps) {
  switch (part.type) {
    case 'text':
      return <TextPart text={part.text} streaming={!part.time?.end} />;

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
      return <ReasoningPart text={part.text} metadata={part.metadata} />;

    case 'file':
      return <FilePart filename={part.filename} mime={part.mime} url={part.url} />;

    case 'agent':
      return (
        <div className="part agent-part">
          <span className="agent-icon">$(person)</span>
          <span className="agent-name">{part.name}</span>
        </div>
      );

    case 'step-start':
      return (
        <div className="part step-start">
          <span className="step-indicator">Step started</span>
        </div>
      );

    case 'step-finish':
      return (
        <div className="part step-finish">
          <span className="step-indicator">Step completed</span>
        </div>
      );

    default:
      return (
        <div className="part unknown">
          <span>Unknown part type: {(part as Part).type}</span>
        </div>
      );
  }
}
