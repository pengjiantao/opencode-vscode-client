/**
 * @file Dispatches rendering of a message part to the appropriate sub-component
 * based on the part type (text, tool, reasoning, file, agent, step).
 */

import type { Part } from '@opencode-ai/sdk/v2/client';
import { Chip } from './Chip';
import { Codicon } from './Codicon';
import { FilePart } from './parts/FilePart';
import { ReasoningPart } from './parts/ReasoningPart';
import { TaskToolPart } from './parts/TaskToolPart';
import { TextPart } from './parts/TextPart';
import { ToolPart, isBashTool } from './parts/ToolPart';

interface PartRendererProps {
  part: Part;
  allParts?: Part[];
  hasPredecessor?: boolean;
  hasSuccessor?: boolean;
}

/** Routes a Part to its type-specific renderer component. */
export function PartRenderer({
  part,
  allParts,
  hasPredecessor = false,
  hasSuccessor = false,
}: PartRendererProps) {
  switch (part.type) {
    case 'text':
      if (part.metadata?.type === 'pasted-text') {
        const meta = part.metadata as { type: string; filename?: string; linesCount?: number };
        return (
          <span className="opencode-chip-inline-wrapper">
            <Chip
              type="text"
              filename={meta.filename || 'Pasted Text'}
              text={part.text}
              linesCount={meta.linesCount}
            />
          </span>
        );
      }
      if (part.metadata?.type === 'command') {
        const meta = part.metadata as { type: string; command?: string; source?: string };
        return (
          <span className="opencode-chip-inline-wrapper">
            <Chip type="command" filename={meta.command || part.text} mime={meta.source} />
          </span>
        );
      }
      if (part.metadata?.type === 'skill') {
        const meta = part.metadata as { type: string; name?: string; description?: string };
        return (
          <span className="opencode-chip-inline-wrapper">
            <Chip type="skill" filename={meta.name || part.text} text={part.text} />
          </span>
        );
      }
      if (!part.text || part.text.trim() === '') {
        return null;
      }
      return <TextPart text={part.text} allParts={allParts} />;

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
      const metadata = (state as { metadata?: Record<string, unknown> }).metadata;
      const isBash = isBashTool(part.tool);
      const completedOutput = state.status === 'completed' ? state.output : undefined;
      const output = isBash
        ? (metadata?.output as string | undefined) || completedOutput
        : completedOutput;
      const error = state.status === 'error' ? (state as { error: string }).error : undefined;

      if (part.tool.toLowerCase() === 'task') {
        return (
          <TaskToolPart
            tool={part.tool}
            state={{
              status: state.status,
              input: state.input,
              output,
              title,
              error,
              time,
              metadata,
            }}
            hasPredecessor={hasPredecessor}
            hasSuccessor={hasSuccessor}
          />
        );
      }

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
            metadata,
          }}
          hasPredecessor={hasPredecessor}
          hasSuccessor={hasSuccessor}
        />
      );
    }

    case 'reasoning':
      return (
        <ReasoningPart
          text={part.text}
          time={part.time}
          metadata={part.metadata}
          hasPredecessor={hasPredecessor}
          hasSuccessor={hasSuccessor}
        />
      );

    case 'file': {
      return <FilePart part={part} />;
    }

    case 'agent':
      return (
        <div className="part agent-part">
          <span className="agent-icon">
            <Codicon name="$(person)" />
          </span>
          <span className="agent-name">{part.name}</span>
        </div>
      );

    case 'subtask': {
      const displayLabel = part.command || part.agent || 'subtask';
      const desc = part.description || '';
      return (
        <p className="part subtask-part">
          <span className="subtask-label">Subtask: {displayLabel}</span>
          {desc && <span className="subtask-desc">{desc}</span>}
        </p>
      );
    }

    case 'step-start':
    case 'step-finish':
      return null;

    default:
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[PartRenderer] Unknown part type: ${(part as Part).type}`);
      }
      return null;
  }
}
