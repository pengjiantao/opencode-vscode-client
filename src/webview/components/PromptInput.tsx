/**
 * @file Bottom prompt input bar featuring inline rich chips for files, images, and text snippets.
 * Utilizes a contenteditable div to support inline attachments and DOM-traversal prompt serialization.
 */

import type { Part, SessionStatus } from '@opencode-ai/sdk/v2/client';
import React from 'react';
import { resolveDefaultModelId } from '../../shared/model-selection';
import type { AgentInfo, ModelInfo, WebviewToExt } from '../../shared/types';
import { useCommandEditor } from '../hooks/useCommandEditor';
import { useIPC } from '../hooks/useIPC';
import { useMentionEditor } from '../hooks/useMentionEditor';
import { usePromptEditor } from '../hooks/usePromptEditor';
import { usePromptSelectionIPC } from '../hooks/usePromptSelectionIPC';
import { useSessionStore } from '../store/sessionStore';
import { getTooltipHtml } from '../utils/chipUtils';
import { restoreUserMessageToEditor } from '../utils/editorRestore';
import { getPromptData } from '../utils/promptSerializer';
import { AgentSelector } from './AgentSelector';
import { CommandListPopover } from './CommandListPopover';
import { IconButton } from './IconButton';
import { MentionPopover } from './MentionPopover';
import { ModelSelector } from './ModelSelector';
import { PromptInputFooter } from './PromptInputFooter';
import { PromptInputHeader } from './PromptInputHeader';
import { VariantSelector } from './VariantSelector';

/** Props interface for PromptInput component */
interface PromptInputProps {
  /** Callback to trigger on prompt submission */
  onSubmit: (text: string, parts: Part[]) => void;
  /** Callback to stop active generation */
  onAbort?: () => void;
  /** Active session generation status */
  status?: SessionStatus;
  /** Supported model models */
  models: ModelInfo[];
  /** List of primary agents */
  agents: AgentInfo[];
  /** Active model ID override */
  activeModel?: string;
  /** Active agent ID override */
  activeAgent?: string;
  /** Active model variants mapping */
  modelVariants?: Record<string, string>;
  /** Callback triggered on model selection change */
  onModelChange: (model: string) => void;
  /** Callback triggered on agent selection change */
  onAgentChange: (agent: string) => void;
  /** Callback triggered when a model variant selection changes */
  onVariantChange?: (model: string, variant: string) => void;
  /** Disable input state */
  disabled?: boolean;
  /** Parts to restore into the editor (e.g. from a revert action). Triggers on change. */
  restoreParts?: Part[];
  /** Callback when the user clicks the Redo button in the header. */
  onRedo?: () => void;
  /** Callback fired after restoreParts have been consumed by the editor. */
  onRestoreComplete?: () => void;
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
  modelVariants = {},
  onModelChange,
  onAgentChange,
  onVariantChange,
  disabled = false,
  restoreParts,
  onRedo,
  onRestoreComplete,
}: PromptInputProps) {
  const [isFocused, setIsFocused] = React.useState(false);
  const [hasContent, setHasContent] = React.useState(false);

  const fileInfos = useSessionStore((s) => s.fileInfos);
  const commands = useSessionStore((s) => s.commands);
  const skills = useSessionStore((s) => s.skills);

  const [localModel, setLocalModel] = React.useState('');
  const [localAgent, setLocalAgent] = React.useState('');

  const selectedModel = controlledModel !== undefined ? controlledModel : localModel;
  const selectedAgent = controlledAgent !== undefined ? controlledAgent : localAgent;

  const editorRef = React.useRef<HTMLDivElement>(null);
  const isRunning = status?.type === 'busy' || status?.type === 'retry';

  const defaultModel = React.useMemo(() => resolveDefaultModelId(models), [models]);
  const activeModel = selectedModel || defaultModel;
  const activeAgent = selectedAgent || (agents.length > 0 ? agents[0].id : '');

  // Find variants and resolved selected variant for active model
  const currentModelVariants = models.find((m) => m.id === activeModel)?.variants || [];
  const savedVariant = modelVariants[activeModel];
  const activeVariant =
    savedVariant && currentModelVariants.includes(savedVariant) ? savedVariant : 'default';

  const activeSessionID = useSessionStore((s) => s.activeSessionID);

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

  const send = React.useCallback((message: WebviewToExt) => {
    window.vscode.postMessage(message);
  }, []);

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

  const {
    commandState,
    commandSelectedIndex,
    setCommandSelectedIndex,
    commandResults,
    closeCommandList,
    handleSlashTrigger,
    onSelectCommandItem,
  } = useCommandEditor({
    editorRef,
    commands,
    skills,
    fileInfos,
    onInput: handleInput,
  });

  const {
    mentionState,
    mentionResults,
    setMentionResults,
    selectedIndex,
    setSelectedIndex,
    mentionTimeoutRef,
    closeMentionList,
    handleMentionTrigger,
    insertMentionChip,
  } = useMentionEditor({
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

  useIPC((message) => {
    if (message.type === 'workspace:search-files-response') {
      setMentionResults(message.results);
      setSelectedIndex(0);
    } else if (message.type === 'file:selected') {
      for (const file of message.files) {
        const isImage = file.mime.startsWith('image/');
        insertChip({
          id: `${isImage ? 'img' : 'file-path'}-${Math.random().toString(36).substring(7)}`,
          type: isImage ? 'image' : 'file',
          path: file.fsPath,
          filename: file.name,
          size: file.size,
          mime: file.mime,
          dataUrl: file.dataUrl,
        });
      }
    }
  });

  const handleSelectLocalFile = React.useCallback(() => {
    send({ type: 'file:select' });
  }, [send]);

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
  }, [mentionTimeoutRef]);

  // Restore parts into the editor when restoreParts prop changes (e.g. from revert action)
  React.useEffect(() => {
    if (restoreParts && restoreParts.length > 0 && editorRef.current) {
      restoreUserMessageToEditor(editorRef.current, restoreParts);
      const { text } = getPromptData(editorRef.current, activeSessionID, fileInfos);
      setHasContent(text.trim().length > 0);
      // Notify parent that restore is complete so it can clear restoreParts
      onRestoreComplete?.();
    }
  }, [restoreParts, activeSessionID, fileInfos, onRestoreComplete]);

  const updateMentionState = React.useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      closeMentionList();
      closeCommandList();
      return;
    }
    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;

    if (textNode.nodeType !== Node.TEXT_NODE) {
      closeMentionList();
      closeCommandList();
      return;
    }

    const text = textNode.textContent || '';
    const offset = range.startOffset;

    // Detect @ for file mentions
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

    // Detect / for commands and skills
    let slashIndex = -1;
    let hasTextBefore = false;
    for (let i = offset - 1; i >= 0; i--) {
      if (text[i] === '/') {
        if (i === 0 || /\s/.test(text[i - 1])) {
          slashIndex = i;
          break;
        }
      }
      if (/\s/.test(text[i])) {
        break;
      }
    }
    // Determine if there is non-whitespace text before the / (check earlier in the text node)
    if (slashIndex !== -1 && slashIndex > 0) {
      hasTextBefore = text.substring(0, slashIndex).trim().length > 0;
    }

    if (atIndex !== -1) {
      const query = text.substring(atIndex + 1, offset);
      handleMentionTrigger(textNode, atIndex, query);
      // Close command list when @ is active
      closeCommandList();
    } else {
      closeMentionList();
    }

    if (slashIndex !== -1) {
      const query = text.substring(slashIndex + 1, offset);
      handleSlashTrigger(textNode, slashIndex, query, hasTextBefore);
    } else {
      closeCommandList();
    }
  }, [closeMentionList, closeCommandList, handleSlashTrigger, handleMentionTrigger]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!disabled && (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      send({ type: 'clipboard:paste-plain-text' });
      return;
    }

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

    if (commandState.show) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeCommandList();
        return;
      }
      if (commandResults.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setCommandSelectedIndex((prev) => (prev + 1) % commandResults.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setCommandSelectedIndex(
            (prev) => (prev - 1 + commandResults.length) % commandResults.length,
          );
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          onSelectCommandItem(commandResults[commandSelectedIndex]);
          return;
        }
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isRunning) {
        handleSubmit();
      }
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

      <CommandListPopover
        show={commandState.show}
        results={commandResults}
        selectedIndex={commandSelectedIndex}
        onSelect={onSelectCommandItem}
        skillsOnly={commandState.skillsOnly}
      />

      <PromptInputHeader onRedo={onRedo} />

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
            // Hide lists after a short timeout so clicks on results are registered first
            mentionTimeoutRef.current = window.setTimeout(() => {
              closeMentionList();
              closeCommandList();
            }, 200);
          }}
          {...{ placeholder: 'Type a message... (Shift+Enter for new line)' }}
          data-testid="prompt-editor"
          data-vscode-context='{"webviewSection": "promptInput"}'
        />

        <div className="prompt-input-footer">
          <div className="selectors">
            <IconButton
              name="attach"
              title="Add File Reference"
              onClick={handleSelectLocalFile}
              disabled={disabled}
              size="medium"
            />

            <ModelSelector
              models={models}
              value={activeModel}
              onChange={(m) => {
                setLocalModel(m);
                onModelChange(m);
              }}
            />

            {currentModelVariants.length > 0 && onVariantChange && (
              <VariantSelector
                variants={currentModelVariants}
                value={activeVariant}
                onChange={(v) => {
                  onVariantChange(activeModel, v);
                }}
              />
            )}

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
