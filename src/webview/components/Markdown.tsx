/**
 * @file Markdown renderer built on a CommonMark/GFM token stream with custom OpenCode integrations.
 * Renders Markdown as a constrained React tree while preserving file references and attachment chips.
 */

import type { Part } from '@opencode-ai/sdk/v2/client';
import MarkdownIt from 'markdown-it';
import type MarkdownToken from 'markdown-it/lib/token.mjs';
import React from 'react';
import type { WebviewToExt } from '../../shared/types';
import { parseAndRenderInlineChip } from '../utils/markdownChipRenderer';
import {
  INLINE_FILE_REFERENCE_PATTERN,
  type MarkdownFileReference,
  parseMarkdownFileReference,
} from '../utils/markdownFileReferences';
import { normalizeMarkdownTables } from '../utils/markdownTableNormalizer';
import { CodeBlock } from './CodeBlock';

/** Allowed container tags produced by the configured Markdown parser. */
type MarkdownContainerTag =
  | 'blockquote'
  | 'del'
  | 'em'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'li'
  | 'ol'
  | 'p'
  | 's'
  | 'strong'
  | 'table'
  | 'tbody'
  | 'td'
  | 'th'
  | 'thead'
  | 'tr'
  | 'ul';

/** Props accepted by the Markdown renderer. */
interface MarkdownProps {
  /** Markdown source text to parse and render. */
  text: string;
  /** Optional message parts for resolving inline attachment chips. */
  allParts?: Part[];
}

/** Metadata attached to text parts that can be rendered as inline chips. */
interface InlineTextMetadata {
  /** Metadata type used to identify special inline payload text parts. */
  type?: string;
  /** Display filename for pasted-text payloads. */
  filename?: string;
  /** Skill name for skill payloads. */
  name?: string;
  /** Command name for command payloads. */
  command?: string;
}

/** Indexed message parts used while rendering custom inline attachment placeholders. */
interface InlineRenderContext {
  /** File parts indexed by their visible filename. */
  partsByFilename: Map<string, Part>;
  /** Pasted text parts indexed by their visible filename. */
  partsByTextFilename: Map<string, Part>;
  /** Image file parts indexed by their visible filename. */
  partsByImageFilename: Map<string, Part>;
  /** Terminal file parts indexed by their visible filename. */
  partsByTerminalFilename: Map<string, Part>;
  /** Command text parts indexed by their command name. */
  partsByCommandName: Map<string, Part>;
  /** Skill text parts indexed by their skill name. */
  partsBySkillName: Map<string, Part>;
}

/** Parsed source split into optional YAML front matter and normal Markdown body. */
interface MarkdownDocument {
  /** YAML front matter content without boundary markers. */
  frontMatter: string | null;
  /** Markdown source passed to the GFM parser. */
  body: string;
}

/** Result returned when rendering a balanced range of Markdown tokens. */
interface TokenRenderResult {
  /** React nodes produced for the token range. */
  nodes: React.ReactNode[];
  /** Index immediately after the closing token, if one was consumed. */
  nextIndex: number;
}

const markdownParser = new MarkdownIt({
  html: false,
  linkify: false,
  breaks: false,
});

const INLINE_CHIP_PATTERN =
  /(\[{1,2}(Code Selection):\s*(.*?)\]\]\]?)|(\[(File|Text|Image|Terminal|Command|Skill):\s*(.*?)\])/;

const markdownContainerTags = new Set<MarkdownContainerTag>([
  'blockquote',
  'del',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'ol',
  'p',
  's',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
]);

/** Sends a local file reference to the extension host for editor navigation. */
function openFileReference(ref: MarkdownFileReference): void {
  const message: WebviewToExt = {
    type: 'file:open',
    path: ref.path,
    ...(ref.startLine ? { startLine: ref.startLine } : {}),
    ...(ref.endLine ? { endLine: ref.endLine } : {}),
  };
  window.vscode.postMessage(message);
}

/** Renders an editor-navigation control for an internal file reference. */
function renderFileReferenceLink(
  children: React.ReactNode,
  ref: MarkdownFileReference,
  key: string,
): React.ReactNode {
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    openFileReference(ref);
  };

  return (
    <button
      key={key}
      type="button"
      className="markdown-link markdown-file-reference"
      onClick={handleClick}
      data-custom-title={`Open ${ref.path}`}
    >
      {children}
    </button>
  );
}

/** Renders local path-and-line text as file navigation controls. */
function renderTextWithFileReferences(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = new RegExp(INLINE_FILE_REFERENCE_PATTERN);
  let match: RegExpExecArray | null;
  let lastIndex = 0;
  let keyIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    const prefix = match[1] ?? '';
    const label = match[2];
    const ref = parseMarkdownFileReference(label, { requireLine: true });

    if (!ref) {
      continue;
    }

    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    if (prefix) {
      parts.push(prefix);
    }
    parts.push(renderFileReferenceLink(label, ref, `${keyPrefix}-file-ref-${keyIndex++}`));
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/** Creates efficient lookup maps for the message parts that can become inline chips. */
function createInlineRenderContext(allParts?: Part[]): InlineRenderContext {
  const context: InlineRenderContext = {
    partsByFilename: new Map<string, Part>(),
    partsByTextFilename: new Map<string, Part>(),
    partsByImageFilename: new Map<string, Part>(),
    partsByTerminalFilename: new Map<string, Part>(),
    partsByCommandName: new Map<string, Part>(),
    partsBySkillName: new Map<string, Part>(),
  };

  for (const part of allParts ?? []) {
    if (part.type === 'file' && part.filename) {
      context.partsByFilename.set(part.filename, part);
      if (part.mime?.startsWith('image/') || part.url?.startsWith('data:image/')) {
        context.partsByImageFilename.set(part.filename, part);
      }
      if (
        part.filename.startsWith('terminal [') ||
        (part.source &&
          (part.source.type === 'file' || part.source.type === 'symbol') &&
          part.source.path.startsWith('terminal-'))
      ) {
        context.partsByTerminalFilename.set(part.filename, part);
      }
      continue;
    }

    if (part.type !== 'text') {
      continue;
    }

    const metadata = part.metadata as InlineTextMetadata | undefined;
    if (metadata?.type === 'pasted-text' && metadata.filename) {
      context.partsByTextFilename.set(metadata.filename, part);
    } else if (metadata?.type === 'command' && metadata.command) {
      context.partsByCommandName.set(metadata.command, part);
    } else if (metadata?.type === 'skill' && metadata.name) {
      context.partsBySkillName.set(metadata.name, part);
    }
  }

  return context;
}

/** Renders OpenCode attachment placeholders inside a parser text token. */
function renderTextWithInlineChips(
  text: string,
  context: InlineRenderContext,
  keyPrefix: string,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const chipPattern = new RegExp(INLINE_CHIP_PATTERN, 'g');
  let match: RegExpExecArray | null;
  let lastIndex = 0;
  let keyIndex = 0;

  while ((match = chipPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        ...renderTextWithFileReferences(
          text.substring(lastIndex, match.index),
          `${keyPrefix}-text`,
        ),
      );
    }

    const chipType = match[2] ?? match[5];
    const chipName = match[3] ?? match[6];
    const chipIndex = keyIndex++;
    let chip =
      chipType && chipName
        ? parseAndRenderInlineChip(
            chipType,
            chipName,
            context.partsByFilename,
            context.partsByTextFilename,
            context.partsByImageFilename,
            context.partsByTerminalFilename,
            context.partsByCommandName,
            context.partsBySkillName,
            chipIndex,
          )
        : null;

    // Legacy code-selection placeholders have one closing bracket from the line range merged into
    // the outer `]]` delimiter. Retrying preserves that format without guessing when it is absent.
    if (!chip && chipType === 'Code Selection' && chipName) {
      chip = parseAndRenderInlineChip(
        chipType,
        `${chipName}]`,
        context.partsByFilename,
        context.partsByTextFilename,
        context.partsByImageFilename,
        context.partsByTerminalFilename,
        context.partsByCommandName,
        context.partsBySkillName,
        chipIndex,
      );
    }
    nodes.push(chip ?? match[0]);
    lastIndex = chipPattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(...renderTextWithFileReferences(text.substring(lastIndex), `${keyPrefix}-tail`));
  }

  return nodes.length > 0 ? nodes : [text];
}

/**
 * Extracts document-start YAML front matter without mistaking ordinary dividers for metadata.
 * An unclosed opening marker remains normal Markdown so streamed or partial messages never hide text.
 */
function splitFrontMatter(text: string): MarkdownDocument {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');

  if (lines[0]?.trim() !== '---') {
    return { frontMatter: null, body: normalized };
  }

  for (let index = 1; index < lines.length; index++) {
    const line = lines[index].trim();
    if (line === '---' || line === '...') {
      return {
        frontMatter: lines.slice(1, index).join('\n'),
        body: lines.slice(index + 1).join('\n'),
      };
    }
  }

  return { frontMatter: null, body: normalized };
}

/**
 * Extracts a supported text alignment declaration from a GFM table cell token.
 * markdown-it's built-in GFM table rule emits this controlled `style` attribute; unknown values stay unset.
 */
function getTableCellStyle(token: MarkdownToken): React.CSSProperties | undefined {
  const alignment = token.attrGet('style')?.match(/text-align:(left|center|right)/)?.[1];
  return alignment === 'left' || alignment === 'center' || alignment === 'right'
    ? { textAlign: alignment }
    : undefined;
}

/** Creates an external anchor or internal editor-navigation control from a Markdown link token. */
function renderLink(
  token: MarkdownToken,
  children: React.ReactNode[],
  key: string,
): React.ReactNode {
  const href = token.attrGet('href') ?? '';
  const fileReference = parseMarkdownFileReference(href, { requireLine: false });
  if (fileReference) {
    return renderFileReferenceLink(children, fileReference, key);
  }

  return (
    <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="markdown-link">
      {children}
    </a>
  );
}

/** Renders a supported Markdown opening token and its already-rendered children. */
function renderContainerToken(
  token: MarkdownToken,
  children: React.ReactNode[],
  key: string,
): React.ReactNode {
  if (token.type === 'link_open') {
    return renderLink(token, children, key);
  }

  if (token.tag === 'p' && token.hidden) {
    return <React.Fragment key={key}>{children}</React.Fragment>;
  }

  if (!markdownContainerTags.has(token.tag as MarkdownContainerTag)) {
    return <React.Fragment key={key}>{children}</React.Fragment>;
  }

  const tag = token.tag as MarkdownContainerTag;
  const style = tag === 'th' || tag === 'td' ? getTableCellStyle(token) : undefined;
  const start = tag === 'ol' ? Number(token.attrGet('start')) || undefined : undefined;
  const className = tag === 'table' ? 'markdown-table' : undefined;
  const element = React.createElement(
    tag,
    {
      key,
      ...(className ? { className } : {}),
      ...(style ? { style } : {}),
      ...(start ? { start } : {}),
    },
    children,
  );

  return tag === 'table' ? (
    <div key={`${key}-wrapper`} className="markdown-table-wrapper">
      {element}
    </div>
  ) : (
    element
  );
}

/** Renders a self-contained Markdown token that does not have a matching closing token. */
function renderLeafToken(
  token: MarkdownToken,
  context: InlineRenderContext,
  key: string,
): React.ReactNode | null {
  switch (token.type) {
    case 'code_inline':
      return <code key={key}>{token.content}</code>;
    case 'code_block':
      return <CodeBlock key={key} lang="" code={token.content} />;
    case 'fence':
      return (
        <CodeBlock
          key={key}
          lang={token.info.trim().split(/\s+/, 1)[0] ?? ''}
          code={token.content}
        />
      );
    case 'hardbreak':
      return <br key={key} />;
    case 'hr':
      return <hr key={key} />;
    case 'image': {
      const source = token.attrGet('src');
      return source ? <img key={key} src={source} alt={token.content} /> : token.content;
    }
    case 'inline':
      return renderTokens(token.children ?? [], context, `${key}-inline`).nodes;
    case 'softbreak':
      return '\n';
    case 'text':
      return renderTextWithInlineChips(token.content, context, key);
    default:
      return token.content || null;
  }
}

/** Renders a balanced token sequence without trusting Markdown source as HTML. */
function renderTokens(
  tokens: MarkdownToken[],
  context: InlineRenderContext,
  keyPrefix: string,
  startIndex = 0,
  closingType?: string,
): TokenRenderResult {
  const nodes: React.ReactNode[] = [];
  let index = startIndex;

  while (index < tokens.length) {
    const token = tokens[index];
    if (closingType && token.type === closingType) {
      return { nodes, nextIndex: index + 1 };
    }

    const key = `${keyPrefix}-${index}`;
    if (token.nesting === 1) {
      const nested = renderTokens(
        tokens,
        context,
        keyPrefix,
        index + 1,
        token.type.replace(/_open$/, '_close'),
      );
      nodes.push(renderContainerToken(token, nested.nodes, key));
      index = nested.nextIndex;
      continue;
    }

    if (token.nesting === -1) {
      index++;
      continue;
    }

    const leaf = renderLeafToken(token, context, key);
    if (leaf !== null) {
      nodes.push(leaf);
    }
    index++;
  }

  return { nodes, nextIndex: index };
}

/**
 * Renders CommonMark/GFM content as a safe React tree with OpenCode-specific file links and chips.
 *
 * @param props Markdown source and optional message parts used by custom inline placeholders.
 * @returns The rendered Markdown document.
 */
export function Markdown({ text, allParts }: MarkdownProps): React.JSX.Element {
  const document = React.useMemo(() => splitFrontMatter(text), [text]);
  const context = React.useMemo(() => createInlineRenderContext(allParts), [allParts]);
  const bodyNodes = React.useMemo(
    () =>
      renderTokens(
        markdownParser.parse(normalizeMarkdownTables(document.body), {}),
        context,
        'markdown',
      ).nodes,
    [context, document.body],
  );

  return (
    <div className="markdown-body">
      {document.frontMatter !== null && (
        <div className="markdown-frontmatter">
          <CodeBlock lang="yaml" code={document.frontMatter} />
        </div>
      )}
      {bodyNodes}
    </div>
  );
}
