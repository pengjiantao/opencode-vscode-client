/**
 * @file Renders a single user→assistant message turn.
 * Displays user message content and, if available, the assistant's response parts and action footer.
 */

import type { Message, Part } from '@opencode-ai/sdk/v2/client';
import { useEffect, useState } from 'react';
import { Codicon } from './Codicon';
import { ForkConfirmDialog } from './ForkConfirmDialog';
import { PartRenderer } from './PartRenderer';
import { RevertConfirmDialog } from './RevertConfirmDialog';
import { ThinkingDots } from './ThinkingDots';

const ATTACHMENT_PLACEHOLDER_PATTERN =
  /\[(?:File|Text|Image|Terminal|Command|Skill):\s*.*?\]|\[\[Code Selection:\s*.*?\]\]/;

interface MessageTurnProps {
  /** The user message initiated in this turn. */
  userMessage: Message;
  /** Single assistant response message (legacy / test support). */
  assistantMessage?: Message;
  /** One or more assistant messages generated as response steps. */
  assistantMessages?: Message[];
  /** Map of all parts keyed by message ID. */
  parts: Record<string, Part[]>;
  /** Whether the assistant is currently generating output (last turn only). */
  isGenerating?: boolean;
  /** Whether this is the last turn in the conversation. */
  isLastTurn?: boolean;
  /** Whether the session is currently busy (any turn). Used to disable revert. */
  isSessionBusy?: boolean;
  /** Whether this turn is hidden due to an active revert. */
  isReverted?: boolean;
  /** Callback when the user confirms reverting this turn's user message. */
  onRevert?: (messageID: string) => void;
  /** Callback when the user confirms forking at this turn's user message. */
  onFork?: (messageID: string) => void;
}

/**
 * Safe type-guard helper to extract fallback text from a message.
 * Prevents unsafe castings and conforms with strict typing rules.
 */
function getMessageText(message: Message): string {
  if (
    message &&
    typeof message === 'object' &&
    'text' in message &&
    typeof (message as { text: unknown }).text === 'string'
  ) {
    return (message as { text: string }).text;
  }
  return '';
}

/**
 * Calculates whether a timeline part has predecessor and successor elements in the chat turn.
 * Used to draw continuous vertical timeline lines.
 */
function getTimelineConnection(
  part: Part,
  visibleParts: Part[],
): { hasPredecessor: boolean; hasSuccessor: boolean } {
  const visIndex = visibleParts.findIndex((p) => p === part);

  let hasPredecessor = false;
  let hasSuccessor = false;

  if (visIndex !== -1 && (part.type === 'reasoning' || part.type === 'tool')) {
    const prevPart = visIndex > 0 ? visibleParts[visIndex - 1] : undefined;
    hasPredecessor = prevPart ? prevPart.type === 'reasoning' || prevPart.type === 'tool' : false;

    const nextPart = visIndex < visibleParts.length - 1 ? visibleParts[visIndex + 1] : undefined;
    hasSuccessor = nextPart ? nextPart.type === 'reasoning' || nextPart.type === 'tool' : false;
  }

  return { hasPredecessor, hasSuccessor };
}

/**
 * Extracts the text metadata type used by inline payload parts.
 * These parts back chips embedded in a separate visible text part.
 */
function getTextMetadataType(part: Part): string | undefined {
  if (part.type !== 'text') return undefined;

  const metadata = part.metadata as { type?: unknown } | undefined;
  return typeof metadata?.type === 'string' ? metadata.type : undefined;
}

/**
 * Extracts metadata used to restore inline command and skill chips.
 * Older messages may not have offset fields, so callers must tolerate undefined.
 */
function getInlinePayloadMetadata(part: Part):
  | {
      type: 'command' | 'skill';
      name: string;
      startOffset?: number;
      placeholder?: string;
    }
  | undefined {
  if (part.type !== 'text') return undefined;

  const metadata = part.metadata as
    | {
        type?: unknown;
        command?: unknown;
        name?: unknown;
        startOffset?: unknown;
        placeholder?: unknown;
      }
    | undefined;
  if (metadata?.type !== 'command' && metadata?.type !== 'skill') return undefined;

  const nameSource = metadata.type === 'command' ? metadata.command : metadata.name;
  if (typeof nameSource !== 'string' || nameSource.length === 0) return undefined;

  return {
    type: metadata.type,
    name: nameSource,
    startOffset: typeof metadata.startOffset === 'number' ? metadata.startOffset : undefined,
    placeholder: typeof metadata.placeholder === 'string' ? metadata.placeholder : undefined,
  };
}

/**
 * Builds the textual placeholder that Markdown can turn back into an inline chip.
 */
function getInlinePlaceholder(part: Part): string | undefined {
  const metadata = getInlinePayloadMetadata(part);
  if (!metadata) return undefined;

  return (
    metadata.placeholder ||
    `[${metadata.type === 'command' ? 'Command' : 'Skill'}: ${metadata.name}]`
  );
}

/**
 * Determines whether a text part should be rendered as visible prose.
 * Inline payloads are resolved by Markdown placeholders and must not render twice.
 */
function isDisplayTextPart(part: Part): boolean {
  const metadataType = getTextMetadataType(part);
  return (
    part.type === 'text' &&
    metadataType !== 'pasted-text' &&
    metadataType !== 'command' &&
    metadataType !== 'skill'
  );
}

/**
 * Infers an insertion point for legacy messages where the backend stored the
 * command/skill part but the visible text no longer contains its placeholder.
 */
function inferLegacyInlineInsertionIndex(text: string): number {
  const nextAttachmentIndex = text.search(ATTACHMENT_PLACEHOLDER_PATTERN);
  const searchEnd = nextAttachmentIndex === -1 ? text.length : nextAttachmentIndex;
  const prefix = text.slice(0, searchEnd);

  const useMatch = /(?:使用|use|using)\s*/i.exec(prefix);
  if (useMatch) {
    return useMatch.index + useMatch[0].length;
  }

  const firstTokenMatch = /^\s*\S+\s*/.exec(prefix);
  if (firstTokenMatch) {
    return firstTokenMatch[0].length;
  }

  return searchEnd;
}

/**
 * Restores missing inline placeholders for command/skill payload parts.
 * This keeps historical or backend-normalized messages from rendering chips
 * below the prompt or dropping them entirely.
 */
function restoreMissingInlinePayloads(text: string, allParts: Part[]): string {
  const insertions = allParts
    .map((part, order) => {
      const placeholder = getInlinePlaceholder(part);
      const metadata = getInlinePayloadMetadata(part);
      if (!placeholder || !metadata || text.includes(placeholder)) return undefined;

      const index =
        metadata.startOffset !== undefined
          ? Math.min(Math.max(metadata.startOffset, 0), text.length)
          : inferLegacyInlineInsertionIndex(text);
      return { index, order, placeholder };
    })
    .filter((item): item is { index: number; order: number; placeholder: string } => !!item)
    .sort((a, b) => b.index - a.index || b.order - a.order);

  return insertions.reduce(
    (result, insertion) =>
      result.slice(0, insertion.index) + insertion.placeholder + result.slice(insertion.index),
    text,
  );
}

/** Returns a display text part with missing command/skill placeholders restored. */
function restoreDisplayTextPart(part: Part, allParts: Part[]): Part {
  if (part.type !== 'text') return part;

  const restoredText = restoreMissingInlinePayloads(part.text, allParts);
  if (restoredText === part.text) return part;

  return { ...part, text: restoredText };
}

/** A paired user message and optional assistant response with part rendering. */
export function MessageTurn({
  userMessage,
  assistantMessage,
  assistantMessages,
  parts,
  isGenerating = false,
  isLastTurn = false,
  isSessionBusy = false,
  isReverted = false,
  onRevert,
  onFork,
}: MessageTurnProps) {
  const [copied, setCopied] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [showForkConfirm, setShowForkConfirm] = useState(false);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => {
        setCopied(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const messagesToRender = assistantMessages
    ? assistantMessages
    : assistantMessage
      ? [assistantMessage]
      : [];

  const copyAnswer = () => {
    if (messagesToRender.length === 0) return;
    const answerText = messagesToRender
      .flatMap((msg) => parts[msg.id] || [])
      .filter((part) => part.type === 'text')
      .map((part) => {
        if ('text' in part && typeof part.text === 'string') {
          return part.text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
    void navigator.clipboard.writeText(answerText || '');
    setCopied(true);
  };

  const scrollToTop = () => {
    const chatView = document.querySelector('.chat-view');
    if (chatView) {
      chatView.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToUserMessage = () => {
    // 查找当前 turn 的用户消息元素
    const turnElement = document.querySelector(`[data-message-id="${userMessage.id}"]`);
    if (turnElement) {
      turnElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const renderUserParts = () => {
    const userParts = parts[userMessage.id];
    if (!userParts) {
      return <p>{getMessageText(userMessage)}</p>;
    }

    const nonSyntheticParts = userParts.filter((p) => !(p as { synthetic?: boolean }).synthetic);

    // If all parts are synthetic (e.g. backend-generated continuation prompts),
    // don't render an empty user bubble.
    if (nonSyntheticParts.length === 0) {
      return null;
    }

    const hasTextPart = nonSyntheticParts.some(isDisplayTextPart);
    if (!hasTextPart) {
      return nonSyntheticParts.map((part) => (
        <PartRenderer key={part.id} part={part} allParts={userParts} />
      ));
    }

    const displayTextParts = nonSyntheticParts.filter(isDisplayTextPart);
    return displayTextParts.map((part, index) => (
      <PartRenderer
        key={part.id}
        part={index === 0 ? restoreDisplayTextPart(part, userParts) : part}
        allParts={userParts}
      />
    ));
  };

  const showActions = messagesToRender.length > 0 && !isGenerating;

  // A subtask user message means a subagent was delegated — a continuation
  // turn is expected, so don't show per-turn action buttons prematurely.
  // Only show them when the entire conversation (including the continuation)
  // is complete, i.e. this subtask turn is also the last turn.
  const userParts = parts[userMessage.id];
  const hasSubtask = userParts?.some((p) => p.type === 'subtask') ?? false;
  const showActionsFinal = showActions && (!hasSubtask || isLastTurn);

  const allAssistantParts = messagesToRender.flatMap((msg) => parts[msg.id] || []);
  const visibleParts = allAssistantParts.filter(
    (p) =>
      (p.type === 'text' && p.text && p.text.trim() !== '') ||
      p.type === 'tool' ||
      p.type === 'reasoning' ||
      p.type === 'file' ||
      p.type === 'subtask',
  );

  const userContent = renderUserParts();

  // Hide this turn entirely if it's been reverted
  if (isReverted) {
    return null;
  }

  const showRevert = !hasSubtask && !!onRevert;
  const showFork = !hasSubtask && !!onFork;
  const showUserActions = showRevert || showFork;

  return (
    <div className="message-turn">
      {userContent && (
        <div className="user-message" data-message-id={userMessage.id}>
          <div className="message-content">{userContent}</div>
          {showUserActions && (
            <div className="user-message-actions">
              {showRevert && (
                <button
                  className={`action-btn revert-btn${isSessionBusy ? ' disabled' : ''}`}
                  onClick={() => !isSessionBusy && setShowRevertConfirm(true)}
                  disabled={isSessionBusy}
                  data-custom-title={
                    isSessionBusy ? 'Cannot revert while running' : 'Revert this message'
                  }
                  data-testid="revert-btn"
                >
                  <Codicon name="discard" />
                  <span>Revert</span>
                </button>
              )}
              {showFork && (
                <button
                  className={`action-btn fork-btn${isSessionBusy ? ' disabled' : ''}`}
                  onClick={() => !isSessionBusy && setShowForkConfirm(true)}
                  disabled={isSessionBusy}
                  data-custom-title={
                    isSessionBusy ? 'Cannot fork while running' : 'Fork from this message'
                  }
                  data-testid="fork-btn"
                >
                  <Codicon name="repo-forked" />
                  <span>Fork</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {messagesToRender.map((msg, msgIndex) => {
        const isLastMsg = msgIndex === messagesToRender.length - 1;
        return (
          <div key={msg.id} className="assistant-message">
            <div className="message-content">
              {parts[msg.id]?.map((part, _index, arr) => {
                const { hasPredecessor, hasSuccessor } = getTimelineConnection(part, visibleParts);

                return (
                  <PartRenderer
                    key={part.id}
                    part={part}
                    allParts={arr}
                    hasPredecessor={hasPredecessor}
                    hasSuccessor={hasSuccessor}
                  />
                );
              })}
              {isGenerating && isLastMsg && <ThinkingDots />}
            </div>
          </div>
        );
      })}

      {showActionsFinal && (
        <div className="message-actions">
          <button
            className="action-btn"
            onClick={copyAnswer}
            data-custom-title={copied ? 'Copied!' : 'Copy Answer'}
          >
            <Codicon name={copied ? '$(check)' : '$(copy)'} />
            <span>{copied ? 'Copied!' : 'Copy Answer'}</span>
          </button>
          <button className="action-btn" onClick={scrollToTop} data-custom-title="Scroll to top">
            <Codicon name="$(arrow-up)" />
            <span>To Top</span>
          </button>
          <button
            className="action-btn"
            onClick={scrollToUserMessage}
            data-custom-title="Scroll to user message"
          >
            <Codicon name="$(chevron-up)" />
            <span>To User Message</span>
          </button>
        </div>
      )}

      <RevertConfirmDialog
        visible={showRevertConfirm}
        onConfirm={() => {
          onRevert?.(userMessage.id);
          setShowRevertConfirm(false);
        }}
        onCancel={() => setShowRevertConfirm(false)}
      />

      <ForkConfirmDialog
        visible={showForkConfirm}
        mode="message"
        onConfirm={() => {
          onFork?.(userMessage.id);
          setShowForkConfirm(false);
        }}
        onCancel={() => setShowForkConfirm(false)}
      />
    </div>
  );
}
