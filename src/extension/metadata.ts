/**
 * @file Handles metadata synchronization between extension host and webview.
 */

import { extensions, workspace } from 'vscode';
import type { SDKClient } from './sdk-client';
import type { CommandInfo, ExtToWebview, LspServerInfo, McpServerInfo, SkillInfo } from './types';

/**
 * Gathers all LSP servers, MCP servers, workspace plugins, discovered skills,
 * workspace root name, and extension version, and pushes them to the webview.
 *
 * @param sdk The active SDKClient instance.
 * @param sendIpc The strongly-typed IPC sender function.
 */
export async function syncMetadata(
  sdk: SDKClient,
  sendIpc: (msg: ExtToWebview) => void,
): Promise<void> {
  try {
    const workspaceFolder = workspace.workspaceFolders?.[0];
    const workspaceName = workspaceFolder ? workspaceFolder.name : null;
    const workspaceRoot = workspaceFolder ? workspaceFolder.uri.fsPath : null;

    // 1. Fetch LSP Status from SDK
    let lspServers: LspServerInfo[] = [];
    try {
      const lspList = await sdk.lsp.status();
      lspServers = lspList.map((lsp) => ({
        name: lsp.name,
        status: lsp.status,
        workspaceFolder: lsp.root,
      }));
    } catch (err) {
      console.error('Failed to fetch LSP status:', err);
    }

    // 2. Fetch MCP Status from SDK
    let mcpServers: McpServerInfo[] = [];
    try {
      const mcpRecord = await sdk.mcp.status();
      mcpServers = Object.keys(mcpRecord).map((name) => {
        const mcp = mcpRecord[name];
        return {
          name,
          status: mcp.status,
          error: 'error' in mcp ? String((mcp as Record<string, unknown>).error) : undefined,
        };
      });
    } catch (err) {
      console.error('Failed to fetch MCP status:', err);
    }

    // 3. Fetch Config and Plugins from SDK
    let plugins: string[] = [];
    try {
      const cfg = await sdk.config.get();
      plugins = (cfg.plugin || []).map((p) => (Array.isArray(p) ? p[0] : p));
    } catch (err) {
      console.error('Failed to fetch config for plugins:', err);
    }

    // 4. Discover Skills (Built-in + SDK)
    const skills: SkillInfo[] = [];

    // Always add the core built-in skill
    skills.push({
      name: 'customize-opencode',
      description:
        "Use ONLY when the user is editing or creating opencode's own configuration: opencode.json, opencode.jsonc, files under .opencode/, or files under ~/.config/opencode/. Also use when creating or fixing opencode agents, subagents, skills, plugins, MCP servers, or permission rules. Do not use for the user's own application code, or for any project that is not configuring opencode itself.",
      location: '<built-in>',
    });

    // Query official skills from SDK
    try {
      const sdkSkills = await sdk.getSkills();
      for (const s of sdkSkills) {
        if (!skills.some((existing) => existing.name === s.name)) {
          skills.push({
            name: s.name,
            description: s.description,
            location: s.location,
            content: s.content,
          });
        }
      }
    } catch (err) {
      console.error('Failed to sync skills from SDK:', err);
    }

    // 5. Fetch available commands from SDK
    let commands: CommandInfo[] = [];
    try {
      commands = await sdk.getCommands();
    } catch (err) {
      console.error('Failed to fetch commands from SDK:', err);
    }

    // 6. Query Active Extension version from VS Code
    const extensionVersion =
      ((
        extensions.getExtension('fiyqkrc.opencode-vscode-client')?.packageJSON as
          | Record<string, unknown>
          | undefined
      )?.version as string) || 'unknown';

    // 7. Push synchronized metadata payload to Webview
    sendIpc({
      type: 'metadata:sync',
      workspaceName,
      workspaceRoot,
      lspServers,
      mcpServers,
      skills,
      commands,
      plugins,
      extensionVersion,
    });
  } catch (err) {
    console.error('Error during metadata sync:', err);
  }
}
