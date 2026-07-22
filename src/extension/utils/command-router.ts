/**
 * @file Helper for detecting, parsing, and routing inline command prompts.
 */

import type { Part } from '@opencode-ai/sdk/v2/client';
import type { IPCBridge } from '../ipc';
import type { SessionManager } from '../session-manager';

/**
 * Interface representing parameter options passed to handleCommandPart.
 */
export interface HandleCommandPartOptions {
  /** Array of Prompt message part attachments, if any */
  parts: Part[] | undefined;
  /** The primary prompt text input */
  text: string | undefined;
  /** The unique ID of the currently active session */
  activeID: string;
  /** The currently selected target LLM model */
  activeModel: string | undefined;
  /** The currently active agent selection */
  activeAgent: string | undefined;
  /** The currently selected model variant (e.g. thinking profile) */
  activeVariant: string | undefined;
  /** The core session manager instance */
  sessionManager: SessionManager;
  /** The extension IPC communication bridge to the webview */
  ipc: IPCBridge;
}

/**
 * Extracted command information returned by extractCommandInfo helper.
 */
export interface ExtractedCommandInfo {
  commandName: string;
  agent?: string;
  args?: string;
}

/**
 * Helper to extract command information (command name, agent, arguments) from parts or text.
 * Tolerates client-constructed parts (metadata.type === 'command') as well as
 * backend-persisted parts (type === 'subtask', type === 'command', or direct command property).
 *
 * Priority Fallback Chain:
 * 1. Backend Subtask Part  (`type === 'subtask'`)  -> `commandName`: `p.command` || `p.agent`, `agent`: `p.agent`, `args`: `p.prompt`
 * 2. Direct Command Part  (`type === 'command'`)  -> `commandName`: `p.command` || `p.name`,  `agent`: `p.agent`, `args`: `p.arguments`
 * 3. Text Part Metadata    (`metadata.type === 'command'`) -> `commandName`: `meta.command` || `p.text`, `args`: text minus placeholder
 * 4. Direct Property       (`p.command` exists)   -> `commandName`: `p.command`, `agent`: `p.agent`, `args`: `p.prompt`
 * 5. Text Fallback         (`[Command: <name>]`) -> `commandName`: extracted from match, `args`: text minus placeholder
 *
 * @param parts Message parts array, if available.
 * @param text Prompt text content, if available.
 * @returns ExtractedCommandInfo if a command was found; undefined otherwise.
 */
export function extractCommandInfo(
  parts: Part[] | undefined,
  text: string | undefined,
): ExtractedCommandInfo | undefined {
  if (parts && parts.length > 0) {
    for (const p of parts) {
      if (!p || typeof p !== 'object') continue;

      const obj = p as Record<string, unknown>;
      const pType = typeof obj.type === 'string' ? obj.type : '';
      const pCommand = typeof obj.command === 'string' ? obj.command : undefined;
      const pAgent = typeof obj.agent === 'string' ? obj.agent : undefined;
      const pName = typeof obj.name === 'string' ? obj.name : undefined;
      const pPrompt = typeof obj.prompt === 'string' ? obj.prompt : undefined;
      const pArgs = typeof obj.arguments === 'string' ? obj.arguments : undefined;

      // 1. Backend-persisted subtask part (type === 'subtask')
      if (pType === 'subtask') {
        const commandName = pCommand || pAgent || '';
        if (commandName) {
          const args = pPrompt ?? (text || '');
          return { commandName, agent: pAgent, args };
        }
      }

      // 2. Direct command part (type === 'command')
      if (pType === 'command') {
        const commandName = pCommand || pName || '';
        if (commandName) {
          const args = pArgs ?? (text || '');
          return { commandName, agent: pAgent, args };
        }
      }

      // 3. Text part with metadata (e.g. metadata.type === 'command' or metadata.command)
      if (obj.metadata && typeof obj.metadata === 'object') {
        const meta = obj.metadata as Record<string, unknown>;
        const metaType = typeof meta.type === 'string' ? meta.type : undefined;
        const metaCommand = typeof meta.command === 'string' ? meta.command : undefined;
        const metaPlaceholder = typeof meta.placeholder === 'string' ? meta.placeholder : undefined;
        const pText = typeof obj.text === 'string' ? obj.text : undefined;

        if (metaType === 'command' || metaCommand) {
          const commandName = metaCommand || pText || '';
          if (commandName) {
            const placeholder = metaPlaceholder || `[Command: ${commandName}]`;
            const args = (text || '').replace(placeholder, '').trim();
            return { commandName, args };
          }
        }
      }

      // 4. Object has a direct 'command' property (e.g., backend custom part)
      if (pCommand) {
        const args = pPrompt ?? (text || '');
        return { commandName: pCommand, agent: pAgent, args };
      }
    }
  }

  // 5. Fallback: Parse placeholder [Command: <commandName>] from text
  if (text) {
    const match = /\[Command:\s*([^\]]+)\]/i.exec(text);
    if (match) {
      const commandName = match[1].trim();
      const args = text.replace(match[0], '').trim();
      return { commandName, args };
    }
  }

  return undefined;
}

/**
 * Detects if the prompt contains a command part and handles routing/execution via sessionManager.
 *
 * @param params Context parameters for command routing.
 * @returns true if a command part was detected and routed; false otherwise.
 */
export function handleCommandPart(params: HandleCommandPartOptions): boolean {
  const { parts, text, activeID, activeModel, activeAgent, activeVariant, sessionManager, ipc } =
    params;

  const info = extractCommandInfo(parts, text);

  console.log(
    '[prompt:send] command detection:',
    'hasParts=',
    !!parts,
    'partCount=',
    parts?.length,
    'foundCommand=',
    info?.commandName,
    'text=',
    text,
  );

  if (!info || !info.commandName) {
    return false;
  }

  const { commandName, agent: infoAgent, args: infoArgs } = info;
  const targetAgent = infoAgent || activeAgent;
  const targetArgs =
    infoArgs !== undefined
      ? infoArgs
      : (text || '').replace(`[Command: ${commandName}]`, '').trim();

  // "compact" is not registered as a backend slash command (it's only available as a TUI keybinding).
  // We intercept it here and route directly to the SDK's session.summarize() API,
  // bypassing the normal command dispatch path.
  if (commandName === 'compact') {
    console.log('[prompt:send] detected compact command, routing to summarize API');

    void (async () => {
      try {
        await sessionManager.sendCompact(activeID, activeModel);
        console.log('[prompt:send] compact completed successfully');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[prompt:send] compact failed:', err);
        ipc.send({ type: 'error', message: `Compact failed: ${msg}` });
      }
      // Refresh messages after compaction so the webview reflects the summarized context
      try {
        const { messages, parts: fetchedParts } =
          await sessionManager.getMessagesAndParts(activeID);
        ipc.send({ type: 'messages:list', sessionID: activeID, messages, parts: fetchedParts });
      } catch (fetchErr) {
        console.error('[prompt:send] failed to fetch messages after compact:', fetchErr);
        ipc.send({ type: 'error', message: 'Failed to fetch session messages after compact' });
      }
    })();

    return true;
  }

  console.log(
    '[prompt:send] routing to command:',
    commandName,
    'args:',
    targetArgs,
    'agent:',
    targetAgent,
    'session:',
    activeID,
  );

  // Run the command and always fetch the latest messages afterwards.
  // Some plugins (e.g. PTY) intercept commands via hooks and throw to
  // abort the normal flow, but create response messages via SSE before
  // throwing. Always fetching messages ensures these responses are shown.
  void (async () => {
    try {
      await sessionManager.sendCommand(
        activeID,
        commandName,
        targetArgs,
        activeModel,
        targetAgent,
        activeVariant,
      );
    } catch (err) {
      console.error('[prompt:send] command endpoint error (messages may still exist):', err);
    }
    try {
      const { messages, parts: fetchedParts } = await sessionManager.getMessagesAndParts(activeID);
      ipc.send({ type: 'messages:list', sessionID: activeID, messages, parts: fetchedParts });
    } catch (fetchErr) {
      console.error('[prompt:send] failed to fetch messages after command:', fetchErr);
      ipc.send({ type: 'error', message: 'Failed to fetch session messages after command' });
    }
  })();

  return true;
}
