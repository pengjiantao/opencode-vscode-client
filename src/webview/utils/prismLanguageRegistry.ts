/**
 * @file PrismJS language registration and lookup helpers for Markdown code blocks.
 * Centralizes grammar imports and aliases so the renderer supports common fence labels.
 */

// organize-imports-ignore
import Prism from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-basic';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json5';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-objectivec';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-dart';
import 'prismjs/components/prism-fsharp';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-protobuf';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-solidity';
import 'prismjs/components/prism-scala';
import 'prismjs/components/prism-vbnet';
import 'prismjs/components/prism-shell-session';
import 'prismjs/components/prism-plsql';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-scss';
import 'prismjs/components/prism-sass';
import 'prismjs/components/prism-less';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-apacheconf';
import 'prismjs/components/prism-batch';
import 'prismjs/components/prism-clojure';
import 'prismjs/components/prism-csv';
import 'prismjs/components/prism-diff';
import 'prismjs/components/prism-docker';
import 'prismjs/components/prism-editorconfig';
import 'prismjs/components/prism-elixir';
import 'prismjs/components/prism-erlang';
import 'prismjs/components/prism-fortran';
import 'prismjs/components/prism-git';
import 'prismjs/components/prism-graphql';
import 'prismjs/components/prism-haskell';
import 'prismjs/components/prism-hcl';
import 'prismjs/components/prism-http';
import 'prismjs/components/prism-ini';
import 'prismjs/components/prism-julia';
import 'prismjs/components/prism-lua';
import 'prismjs/components/prism-makefile';
import 'prismjs/components/prism-matlab';
import 'prismjs/components/prism-nginx';
import 'prismjs/components/prism-ocaml';
import 'prismjs/components/prism-perl';
import 'prismjs/components/prism-powershell';
import 'prismjs/components/prism-properties';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-r';
import 'prismjs/components/prism-regex';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-toml';
import 'prismjs/components/prism-wasm';

const LANGUAGE_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  'c#': 'csharp',
  'c++': 'cpp',
  cc: 'cpp',
  cjs: 'javascript',
  'c-like': 'clike',
  cmd: 'batch',
  console: 'shell-session',
  cs: 'csharp',
  csharp: 'csharp',
  cts: 'typescript',
  cxx: 'cpp',
  dockerfile: 'docker',
  dotenv: 'properties',
  dotnet: 'csharp',
  env: 'properties',
  f90: 'fortran',
  fs: 'fsharp',
  fsharp: 'fsharp',
  gitignore: 'git',
  golang: 'go',
  hpp: 'cpp',
  htm: 'markup',
  html: 'markup',
  java: 'java',
  js: 'javascript',
  jsonc: 'json',
  kt: 'kotlin',
  kts: 'kotlin',
  make: 'makefile',
  md: 'markdown',
  mdx: 'markdown',
  mjs: 'javascript',
  mts: 'typescript',
  objc: 'objectivec',
  objectivec: 'objectivec',
  'objective-c': 'objectivec',
  patch: 'diff',
  plain: 'plaintext',
  plaintext: 'plaintext',
  properties: 'properties',
  ps1: 'powershell',
  py: 'python',
  py3: 'python',
  python3: 'python',
  rb: 'ruby',
  rs: 'rust',
  shell: 'bash',
  shellsession: 'shell-session',
  sh: 'bash',
  'sh-session': 'shell-session',
  sol: 'solidity',
  svg: 'markup',
  svelte: 'markup',
  terminal: 'shell-session',
  terraform: 'hcl',
  text: 'plaintext',
  tf: 'hcl',
  tfvars: 'hcl',
  ts: 'typescript',
  txt: 'plaintext',
  vb: 'vbnet',
  vue: 'markup',
  xml: 'markup',
  yml: 'yaml',
  zsh: 'bash',
});

/** Resolved Prism language metadata for a Markdown code fence. */
export interface PrismLanguageResolution {
  /** Canonical Prism language id, or `plaintext` when no grammar should be applied. */
  languageId: string;
  /** Human-facing language label displayed in the code block header. */
  displayName: string;
  /** Prism grammar used for tokenization; `null` means render plain escaped text. */
  grammar: Prism.Grammar | null;
}

/**
 * Resolves a Markdown fence info string to a Prism grammar.
 *
 * @param rawLanguage The raw code fence language text after the opening backticks.
 * @returns Canonical language metadata and a grammar when Prism supports it.
 */
export function resolvePrismLanguage(rawLanguage: string): PrismLanguageResolution {
  const displayName = extractDisplayLanguage(rawLanguage);
  const normalized = normalizeLanguageId(displayName);
  const languageId = LANGUAGE_ALIASES[normalized] ?? normalized;

  if (!languageId || languageId === 'plaintext') {
    return {
      languageId: 'plaintext',
      displayName: displayName || 'code',
      grammar: null,
    };
  }

  const grammar = Prism.languages[languageId];
  if (!grammar) {
    return {
      languageId: 'plaintext',
      displayName: displayName || 'code',
      grammar: null,
    };
  }

  return {
    languageId,
    displayName: displayName || languageId,
    grammar,
  };
}

function extractDisplayLanguage(rawLanguage: string): string {
  const trimmed = rawLanguage.trim();
  if (!trimmed) {
    return '';
  }

  const attributeMatch = trimmed.match(/^\{\s*\.?([A-Za-z0-9_#+.-]+)/);
  if (attributeMatch) {
    return attributeMatch[1];
  }

  return trimmed.split(/\s+/)[0].replace(/^language-/, '');
}

function normalizeLanguageId(language: string): string {
  return language.trim().replace(/^\./, '').replace(/,$/, '').toLowerCase();
}
