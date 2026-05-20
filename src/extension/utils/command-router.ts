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
  /** The core session manager instance */
  sessionManager: SessionManager;
  /** The extension IPC communication bridge to the webview */
  ipc: IPCBridge;
}

/**
 * Detects if the prompt contains a command part and handles routing/execution via sessionManager.
 *
 * @param params Context parameters for command routing.
 * @returns true if a command part was detected and routed; false otherwise.
 */
export function handleCommandPart(params: HandleCommandPartOptions): boolean {
  const { parts, text, activeID, activeModel, activeAgent, sessionManager, ipc } = params;

  const commandPart = parts?.find(
    (p) =>
      p.type === 'text' &&
      (p as Record<string, unknown>).metadata &&
      ((p as Record<string, unknown>).metadata as Record<string, string>).type === 'command',
  ) as Record<string, unknown> | undefined;

  console.log(
    '[prompt:send] command detection:',
    'hasParts=',
    !!parts,
    'partCount=',
    parts?.length,
    'foundCommandPart=',
    !!commandPart,
    'text=',
    text,
  );

  if (!commandPart) {
    return false;
  }

  const commandName =
    (commandPart.metadata as Record<string, string>).command || (commandPart.text as string) || '';
  // Extract arguments text by stripping the command placeholder from prompt text
  // Note: backend requires `arguments` to be a non-optional string, never omit it
  const placeholder = `[Command: ${commandName}]`;
  const args = (text || '').replace(placeholder, '').trim();

  console.log(
    '[prompt:send] routing to command:',
    commandName,
    'args:',
    args,
    'session:',
    activeID,
  );

  // Run the command and always fetch the latest messages afterwards.
  // Some plugins (e.g. PTY) intercept commands via hooks and throw to
  // abort the normal flow, but create response messages via SSE before
  // throwing. Always fetching messages ensures these responses are shown.
  void (async () => {
    try {
      await sessionManager.sendCommand(activeID, commandName, args, activeModel, activeAgent);
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
