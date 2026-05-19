/**
 * @file Bottom prompt input bar featuring inline rich chips for files, images, and text snippets.
 * Utilizes a contenteditable div to support inline attachments and DOM-traversal prompt serialization.
 */

import type { Part, SessionStatus } from '@opencode-ai/sdk/v2/client';
import React from 'react';
import { useIPC } from '../hooks/useIPC';
import { usePromptEditor } from '../hooks/usePromptEditor';
import { usePromptSelectionIPC } from '../hooks/usePromptSelectionIPC';
import { useSessionStore } from '../store/sessionStore';
import '../styles/footer.css';
import { getIconClass, getPromptData, getTooltipHtml } from '../utils/chipUtils';
import { AgentSelector } from './AgentSelector';
import { IconButton } from './IconButton';
import { MentionPopover } from './MentionPopover';
import { ModelSelector } from './ModelSelector';
import { PromptInputFooter } from './PromptInputFooter';

/** Props interface for PromptInput component */
interface PromptInputProps {
  /** Callback to trigger on prompt submission */
  onSubmit: (text: string, parts: Part[]) => void;
  /** Callback to stop active generation */
  onAbort?: () => void;
  /** Active session generation status */
  status?: SessionStatus;
  /** Supported model models */
  models: Array<{
    id: string;
    name: string;
    providerId?: string;
    providerName?: string;
    isConnected?: boolean;
    contextLimit?: number;
  }>;
  /** List of primary agents */
  agents: Array<{ id: string; name: string }>;
  /** Active model ID override */
  activeModel?: string;
  /** Active agent ID override */
  activeAgent?: string;
  /** Callback triggered on model selection change */
  onModelChange: (model: string) => void;
  /** Callback triggered on agent selection change */
  onAgentChange: (agent: string) => void;
  /** Disable input state */
  disabled?: boolean;
}

/** Bottom input bar with inline editable rich chips, selectors, and execution controls. */
export function PromptInput({
  onSubmit,
  onAbort,
  status,
  models,
  agents,
  activeModel: controlledModel,
  activeAgent: controlledAgent,
  onModelChange,
  onAgentChange,
  disabled = false,
}: PromptInputProps) {
  const [isFocused, setIsFocused] = React.useState(false);
  const [hasContent, setHasContent] = React.useState(false);

  const fileInfos = useSessionStore((s) => s.fileInfos);

  const [localModel, setLocalModel] = React.useState('');
  const [localAgent, setLocalAgent] = React.useState('');

  const selectedModel = controlledModel !== undefined ? controlledModel : localModel;
  const selectedAgent = controlledAgent !== undefined ? controlledAgent : localAgent;

  const editorRef = React.useRef<HTMLDivElement>(null);
  const isRunning = status?.type === 'busy' || status?.type === 'retry';

  const activeModel = selectedModel || (models.length > 0 ? models[0].id : '');
  const activeAgent = selectedAgent || (agents.length > 0 ? agents[0].id : '');

  const activeSessionID = useSessionStore((s) => s.activeSessionID);

  const [mentionState, setMentionState] = React.useState<{
    show: boolean;
    query: string;
    startOffset: number;
    textNode: Node | null;
  }>({
    show: false,
    query: '',
    startOffset: -1,
    textNode: null,
  });

  const [mentionResults, setMentionResults] = React.useState<
    Array<{
      name: string;
      relativePath: string;
      type: 'file' | 'dir';
      fsPath: string;
    }>
  >([]);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const mentionTimeoutRef = React.useRef<number | null>(null);

  const closeMentionList = React.useCallback(() => {
    if (mentionTimeoutRef.current) {
      window.clearTimeout(mentionTimeoutRef.current);
      mentionTimeoutRef.current = null;
    }
    setMentionState({ show: false, query: '', startOffset: -1, textNode: null });
    setMentionResults([]);
    setSelectedIndex(0);
  }, []);

  const handleSubmit = React.useCallback(() => {
    if (isRunning) {
      onAbort?.();
    } else {
      const { text: promptText, parts: attachmentParts } = getPromptData(
        editorRef.current,
        activeSessionID,
        fileInfos,
      );
      const trimmedText = promptText.trim();
      if (trimmedText || attachmentParts.length > 0) {
        const finalParts: Part[] = [];
        if (trimmedText) {
          finalParts.push({
            type: 'text',
            id: `temp-text-${Date.now()}`,
            sessionID: activeSessionID || 'temp',
            messageID: 'temp',
            text: trimmedText,
          } as unknown as Part);
        }
        finalParts.push(...attachmentParts);

        onSubmit(trimmedText, finalParts);

        if (editorRef.current) {
          editorRef.current.innerHTML = '';
        }
        setHasContent(false);
      }
    }
  }, [isRunning, onAbort, activeSessionID, fileInfos, onSubmit]);

  const { send } = useIPC((message) => {
    if (message.type === 'workspace:search-files-response') {
      setMentionResults(message.results);
      setSelectedIndex(0);
    }
  });

  const handleInput = React.useCallback(() => {
    const { text } = getPromptData(editorRef.current, activeSessionID, fileInfos);
    setHasContent(text.trim().length > 0);
  }, [activeSessionID, fileInfos]);

  const { handlePaste, insertChip, insertText } = usePromptEditor({
    editorRef,
    fileInfos,
    send,
    onInput: handleInput,
  });

  usePromptSelectionIPC({
    insertChip,
    insertText,
    onSubmit: handleSubmit,
  });

  React.useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      onModelChange(models[0].id);
    }
  }, [models, selectedModel, onModelChange]);

  React.useEffect(() => {
    if (agents.length > 0 && !selectedAgent) {
      onAgentChange(agents[0].id);
    }
  }, [agents, selectedAgent, onAgentChange]);

  // Synchronously update tooltip custom titles when async file queries settle
  React.useEffect(() => {
    if (editorRef.current) {
      const fileChips = editorRef.current.querySelectorAll('.opencode-chip[data-chip-type="file"]');
      fileChips.forEach((chipEl) => {
        const path = chipEl.getAttribute('data-chip-path');
        if (path) {
          const cached = fileInfos[path];
          if (cached) {
            const chipData = {
              type: 'file' as const,
              path,
              filename: chipEl.getAttribute('data-chip-filename') || undefined,
              text: chipEl.getAttribute('data-chip-text') || undefined,
              size: Number(chipEl.getAttribute('data-chip-size') || '0'),
              mime: chipEl.getAttribute('data-chip-mime') || undefined,
              isWorkspace: chipEl.getAttribute('data-chip-is-workspace') === 'true',
            };
            const tooltipHtml = getTooltipHtml(chipData, fileInfos);
            chipEl.setAttribute('data-custom-title', tooltipHtml);
          }
        }
      });
    }
  }, [fileInfos]);

  // Trigger file/directory search query when mention autocomplete becomes active
  React.useEffect(() => {
    if (mentionState.show) {
      send({ type: 'workspace:search-files', query: mentionState.query });
    }
  }, [mentionState.show, mentionState.query, send]);

  React.useEffect(() => {
    return () => {
      if (mentionTimeoutRef.current) {
        window.clearTimeout(mentionTimeoutRef.current);
      }
    };
  }, []);

  const updateMentionState = React.useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      closeMentionList();
      return;
    }
    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;

    if (textNode.nodeType !== Node.TEXT_NODE) {
      closeMentionList();
      return;
    }

    const text = textNode.textContent || '';
    const offset = range.startOffset;

    let atIndex = -1;
    for (let i = offset - 1; i >= 0; i--) {
      if (text[i] === '@') {
        if (i === 0 || /\s/.test(text[i - 1])) {
          atIndex = i;
          break;
        }
      }
      if (/\s/.test(text[i])) {
        break;
      }
    }

    if (atIndex !== -1) {
      const query = text.substring(atIndex + 1, offset);
      setMentionState({
        show: true,
        query,
        startOffset: atIndex,
        textNode,
      });
    } else {
      closeMentionList();
    }
  }, [closeMentionList]);

  const insertMentionChip = React.useCallback(
    (item: { name: string; relativePath: string; type: 'file' | 'dir'; fsPath: string }) => {
      if (!mentionState.textNode) return;

      const selection = window.getSelection();
      if (!selection) return;

      const range = document.createRange();
      try {
        range.setStart(mentionState.textNode, mentionState.startOffset);
        const currentRange = selection.getRangeAt(0);
        range.setEnd(mentionState.textNode, currentRange.startOffset);
      } catch (e) {
        console.error('Failed to set range for mention insertion:', e);
        return;
      }

      const chipId = `file-${Math.random().toString(36).substring(7)}`;
      const chipType = 'file';
      let mime = 'text/plain';
      if (item.type === 'dir') {
        mime = 'directory';
      } else {
        const ext = item.name.split('.').pop()?.toLowerCase();
        if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif' || ext === 'webp') {
          mime = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        } else if (ext === 'pdf') {
          mime = 'application/pdf';
        }
      }

      const chipNode = document.createElement('span');
      chipNode.className = `opencode-chip file-chip inline-chip`;
      chipNode.contentEditable = 'false';
      chipNode.setAttribute('data-chip-id', chipId);
      chipNode.setAttribute('data-chip-type', chipType);
      chipNode.setAttribute('data-chip-filename', item.name);
      chipNode.setAttribute('data-chip-path', item.fsPath);
      chipNode.setAttribute('data-chip-mime', mime);
      chipNode.setAttribute('data-chip-is-workspace', 'true');

      if (item.type === 'file') {
        send({ type: 'file:query', path: item.fsPath });
      }

      const iconClass = getIconClass(chipType, mime);
      const iconSpan = document.createElement('span');
      iconSpan.className = 'chip-icon';
      const iconI = document.createElement('i');
      iconI.className = `codicon codicon-${iconClass}`;
      iconSpan.appendChild(iconI);
      chipNode.appendChild(iconSpan);

      const labelSpan = document.createElement('span');
      labelSpan.className = 'chip-label';
      labelSpan.textContent = item.name;
      chipNode.appendChild(labelSpan);

      const tooltipHtml = getTooltipHtml(
        {
          type: chipType,
          filename: item.name,
          path: item.fsPath,
          mime,
          isWorkspace: true,
        },
        fileInfos,
      );
      chipNode.setAttribute('data-custom-title', tooltipHtml);

      range.deleteContents();
      range.insertNode(chipNode);

      const newRange = document.createRange();
      newRange.setStartAfter(chipNode);
      newRange.setEndAfter(chipNode);
      selection.removeAllRanges();
      selection.addRange(newRange);

      closeMentionList();
      handleInput();
    },
    [mentionState, fileInfos, send, handleInput, closeMentionList],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (mentionState.show) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMentionList();
        return;
      }
      if (mentionResults.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % mentionResults.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + mentionResults.length) % mentionResults.length);
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          insertMentionChip(mentionResults[selectedIndex]);
          return;
        }
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="prompt-input">
      <MentionPopover
        show={mentionState.show}
        results={mentionResults}
        selectedIndex={selectedIndex}
        onSelect={insertMentionChip}
      />

      <div className={`prompt-input-container ${isFocused ? 'focused' : ''}`}>
        <div
          ref={editorRef}
          className="prompt-input-editor"
          contentEditable={!disabled}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onKeyUp={updateMentionState}
          onMouseUp={updateMentionState}
          onPaste={handlePaste}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            // Hide list after a short timeout so clicks on results are registered first
            mentionTimeoutRef.current = window.setTimeout(() => {
              closeMentionList();
            }, 200);
          }}
          {...{ placeholder: 'Type a message... (Shift+Enter for new line)' }}
          data-testid="prompt-editor"
        />

        <div className="prompt-input-footer">
          <div className="selectors">
            <ModelSelector
              models={models}
              value={activeModel}
              onChange={(m) => {
                setLocalModel(m);
                onModelChange(m);
              }}
            />

            <AgentSelector
              agents={agents}
              value={activeAgent}
              onChange={(a) => {
                setLocalAgent(a);
                onAgentChange(a);
              }}
            />
          </div>

          <span
            data-custom-title={isRunning ? 'Stop' : 'Send'}
            style={{
              display: 'inline-flex',
              cursor: disabled || (!isRunning && !hasContent) ? 'not-allowed' : 'default',
            }}
          >
            <IconButton
              name={isRunning ? 'debug-stop' : 'send'}
              onClick={handleSubmit}
              disabled={disabled || (!isRunning && !hasContent)}
              title={isRunning ? 'Stop' : 'Send'}
              className={isRunning ? 'stop-btn' : 'send-btn'}
              size="medium"
              style={{
                pointerEvents: disabled || (!isRunning && !hasContent) ? 'none' : 'auto',
              }}
            />
          </span>
        </div>
      </div>

      <PromptInputFooter models={models} activeModel={activeModel} />
    </div>
  );
}
