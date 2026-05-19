/**
 * @file Bottom prompt input bar featuring inline rich chips for files, images, and text snippets.
 * Utilizes a contenteditable div to support inline attachments and DOM-traversal prompt serialization.
 */

import type { Part, SessionStatus } from '@opencode-ai/sdk/v2/client';
import React from 'react';
import { useIPC } from '../hooks/useIPC';
import { useSessionStore } from '../store/sessionStore';
import '../styles/footer.css';
import { getIconClass, getPromptData, getTooltipHtml } from '../utils/chipUtils';
import { AgentSelector } from './AgentSelector';
import { IconButton } from './IconButton';
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
  const { send } = useIPC(() => {});

  const [localModel, setLocalModel] = React.useState('');
  const [localAgent, setLocalAgent] = React.useState('');

  const selectedModel = controlledModel !== undefined ? controlledModel : localModel;
  const selectedAgent = controlledAgent !== undefined ? controlledAgent : localAgent;

  const editorRef = React.useRef<HTMLDivElement>(null);
  const isRunning = status?.type === 'busy' || status?.type === 'retry';

  const activeModel = selectedModel || (models.length > 0 ? models[0].id : '');
  const activeAgent = selectedAgent || (agents.length > 0 ? agents[0].id : '');

  const activeSessionID = useSessionStore((s) => s.activeSessionID);

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

  const handleInput = React.useCallback(() => {
    const { text } = getPromptData(editorRef.current, activeSessionID, fileInfos);
    setHasContent(text.trim().length > 0);
  }, [activeSessionID, fileInfos]);

  const insertChip = React.useCallback(
    (chip: {
      id: string;
      type: 'file' | 'image' | 'text';
      filename?: string;
      path?: string;
      text?: string;
      size?: number;
      mime?: string;
      isWorkspace?: boolean;
      dataUrl?: string;
      linesCount?: number;
    }) => {
      const selection = window.getSelection();
      let range: Range | null = null;
      if (selection && selection.rangeCount > 0) {
        const potentialRange = selection.getRangeAt(0);
        if (
          editorRef.current &&
          editorRef.current.contains(potentialRange.commonAncestorContainer)
        ) {
          range = potentialRange;
        }
      }

      const chipNode = document.createElement('span');
      chipNode.className = `opencode-chip ${chip.type}-chip inline-chip`;
      chipNode.contentEditable = 'false';
      chipNode.setAttribute('data-chip-id', chip.id);
      chipNode.setAttribute('data-chip-type', chip.type);
      if (chip.filename) chipNode.setAttribute('data-chip-filename', chip.filename);
      if (chip.path) chipNode.setAttribute('data-chip-path', chip.path);
      if (chip.text) chipNode.setAttribute('data-chip-text', chip.text);
      if (chip.size) chipNode.setAttribute('data-chip-size', String(chip.size));
      if (chip.mime) chipNode.setAttribute('data-chip-mime', chip.mime);
      if (chip.isWorkspace) chipNode.setAttribute('data-chip-is-workspace', 'true');
      if (chip.dataUrl) chipNode.setAttribute('data-chip-data-url', chip.dataUrl);
      if (chip.linesCount) chipNode.setAttribute('data-chip-lines-count', String(chip.linesCount));

      if (chip.type === 'file' && chip.path) {
        send({ type: 'file:query', path: chip.path });
      }

      const iconClass = getIconClass(chip.type, chip.mime);
      const displayLabel =
        chip.type === 'text' ? `Pasted ${chip.linesCount} Lines` : chip.filename || 'file';

      const iconSpan = document.createElement('span');
      iconSpan.className = 'chip-icon';
      const iconI = document.createElement('i');
      iconI.className = `codicon codicon-${iconClass}`;
      iconSpan.appendChild(iconI);
      chipNode.appendChild(iconSpan);

      const labelSpan = document.createElement('span');
      labelSpan.className = 'chip-label';
      labelSpan.textContent = displayLabel;
      chipNode.appendChild(labelSpan);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'chip-remove-btn';
      removeBtn.setAttribute('aria-label', 'Remove attachment');
      const closeI = document.createElement('i');
      closeI.className = 'codicon codicon-close';
      removeBtn.appendChild(closeI);
      chipNode.appendChild(removeBtn);

      const tooltipHtml = getTooltipHtml(chip, fileInfos);
      chipNode.setAttribute('data-custom-title', tooltipHtml);

      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chipNode.remove();
        handleInput();
      });

      if (editorRef.current) {
        editorRef.current.focus();
      }

      if (range) {
        range.deleteContents();
        range.insertNode(chipNode);

        const spaceNode = document.createTextNode(' ');
        chipNode.parentNode?.insertBefore(spaceNode, chipNode.nextSibling);

        const newRange = document.createRange();
        newRange.setStart(spaceNode, 1);
        newRange.setEnd(spaceNode, 1);
        selection?.removeAllRanges();
        selection?.addRange(newRange);
      } else if (editorRef.current) {
        editorRef.current.appendChild(chipNode);
        const spaceNode = document.createTextNode(' ');
        editorRef.current.appendChild(spaceNode);

        const newRange = document.createRange();
        newRange.setStart(spaceNode, 1);
        newRange.setEnd(spaceNode, 1);
        selection?.removeAllRanges();
        selection?.addRange(newRange);
      }

      handleInput();
    },
    [fileInfos, send, handleInput],
  );

  const handleSubmit = () => {
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
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const pastedText = e.clipboardData.getData('text/plain')?.trim();
    const pathPattern = /^(file:\/\/|\/|[a-zA-Z]:\\).+/;
    const isPastedPath = pastedText && pathPattern.test(pastedText);

    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      const files = Array.from(e.clipboardData.files);
      let handled = false;

      for (const file of files) {
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          handled = true;
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            insertChip({
              id: `img-${Math.random().toString(36).substring(7)}`,
              type: 'image',
              filename: file.name || 'Pasted Image',
              size: file.size,
              mime: file.type,
              dataUrl,
            });
          };
          reader.readAsDataURL(file);
        } else {
          const resolvedPath =
            (file as unknown as { path?: string }).path || (isPastedPath ? pastedText : undefined);
          if (resolvedPath) {
            e.preventDefault();
            handled = true;
            const isImage =
              file.type?.startsWith('image/') ||
              resolvedPath.toLowerCase().endsWith('.png') ||
              resolvedPath.toLowerCase().endsWith('.jpg') ||
              resolvedPath.toLowerCase().endsWith('.jpeg') ||
              resolvedPath.toLowerCase().endsWith('.gif') ||
              resolvedPath.toLowerCase().endsWith('.webp');
            const isPdf =
              file.type === 'application/pdf' || resolvedPath.toLowerCase().endsWith('.pdf');
            const resolvedMime = isImage
              ? file.type || 'image/png'
              : isPdf
                ? 'application/pdf'
                : 'text/plain';
            insertChip({
              id: `file-path-${Math.random().toString(36).substring(7)}`,
              type: 'file',
              path: resolvedPath,
              filename: file.name || resolvedPath.split(/[\\/]/).pop() || 'file',
              size: file.size,
              mime: resolvedMime,
            });
          } else {
            e.preventDefault();
            handled = true;
            const reader = new FileReader();
            reader.onload = () => {
              const textContent = reader.result as string;
              const linesCount = textContent.split('\n').length;
              const isImage =
                file.type?.startsWith('image/') ||
                file.name.toLowerCase().endsWith('.png') ||
                file.name.toLowerCase().endsWith('.jpg') ||
                file.name.toLowerCase().endsWith('.jpeg') ||
                file.name.toLowerCase().endsWith('.gif') ||
                file.name.toLowerCase().endsWith('.webp');
              const isPdf =
                file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
              const resolvedMime = isImage
                ? file.type || 'image/png'
                : isPdf
                  ? 'application/pdf'
                  : 'text/plain';
              insertChip({
                id: `file-${Math.random().toString(36).substring(7)}`,
                type: 'file',
                filename: file.name,
                size: file.size,
                mime: resolvedMime,
                text: textContent,
                linesCount,
              });
            };
            reader.readAsText(file);
          }
        }
      }

      if (handled) return;
    }

    if (pastedText) {
      if (isPastedPath) {
        e.preventDefault();
        const isImage =
          pastedText.toLowerCase().endsWith('.png') ||
          pastedText.toLowerCase().endsWith('.jpg') ||
          pastedText.toLowerCase().endsWith('.jpeg') ||
          pastedText.toLowerCase().endsWith('.gif') ||
          pastedText.toLowerCase().endsWith('.webp');
        const isPdf = pastedText.toLowerCase().endsWith('.pdf');
        const resolvedMime = isImage ? 'image/png' : isPdf ? 'application/pdf' : 'text/plain';
        insertChip({
          id: `file-path-${Math.random().toString(36).substring(7)}`,
          type: 'file',
          path: pastedText,
          filename: pastedText.split(/[\\/]/).pop() || 'file',
          mime: resolvedMime,
        });
        return;
      }

      if (pastedText.includes('\n') || pastedText.includes('\r')) {
        e.preventDefault();
        const linesCount = pastedText.split(/\r?\n/).length;
        insertChip({
          id: `text-${Math.random().toString(36).substring(7)}`,
          type: 'text',
          filename: `Pasted ${linesCount} Lines`,
          text: pastedText,
          linesCount,
        });
        return;
      }

      e.preventDefault();
      document.execCommand('insertText', false, pastedText);
      handleInput();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="prompt-input">
      <div className={`prompt-input-container ${isFocused ? 'focused' : ''}`}>
        <div
          ref={editorRef}
          className="prompt-input-editor"
          contentEditable={!disabled}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
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
