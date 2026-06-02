/**
 * @file File path utility functions.
 *
 * Includes filename/directory extraction plus a hand-rolled mapping from file
 * extensions to Material Icon Theme icon names. The icons themselves are
 * vendored under `src/webview/assets/file-icons/icons/` (MIT, see manifest).
 */

import { FILE_ICON_URLS } from '../assets/file-icons/manifest';

/** Extracts the filename from a file path. */
export function getFilename(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] ?? filePath;
}

/** Extracts the directory path (without filename) from a file path. */
export function getDirectory(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  parts.pop();
  return parts.join('/');
}

/**
 * Special filenames (no extension or extensionless) mapped to a specific icon
 * (without the `.svg` suffix). Matched case-insensitively against the basename.
 */
const FILENAME_ICON_MAP: Readonly<Record<string, string>> = {
  dockerfile: 'docker',
  containerfile: 'docker',
  makefile: 'makefile',
  cmakelists: 'cmake',
  rakefile: 'ruby',
  jenkinsfile: 'docker',
  vagrantfile: 'docker',
  license: 'license',
  licence: 'license',
  readme: 'markdown',
  changelog: 'changelog',
  authors: 'authors',
  contributors: 'authors',
  package: 'npm',
  tsconfig: 'tsconfig',
  jsconfig: 'editorconfig',
};

/**
 * File extension → icon name (without `.svg` suffix). Keys are lowercase,
 * no leading dot. The icon must exist in the curated `icons/` subset.
 */
const EXTENSION_ICON_MAP: Readonly<Record<string, string>> = {
  // TypeScript / JavaScript
  ts: 'typescript',
  tsx: 'react_ts',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'react',
  mjs: 'javascript',
  cjs: 'javascript',
  // Web / styling
  html: 'html',
  htm: 'html',
  vue: 'vue',
  svelte: 'svelte',
  angular: 'angular', // also matches .component.ts but rare
  css: 'css',
  sass: 'sass',
  scss: 'sass',
  less: 'less',
  postcss: 'postcss',
  pcss: 'postcss',
  // Source code
  py: 'python',
  rb: 'ruby',
  php: 'php',
  go: 'go',
  rs: 'rust',
  swift: 'swift',
  kt: 'kotlin',
  kts: 'kotlin',
  scala: 'scala',
  clj: 'clojure',
  cljs: 'clojure',
  cljc: 'clojure',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  hrl: 'erlang',
  hs: 'haskell',
  lua: 'lua',
  r: 'r',
  dart: 'dart',
  zig: 'zig',
  perl: 'vim', // no perl.svg, vim is closest
  pl: 'vim',
  pm: 'vim',
  groovy: 'groovy',
  gradle: 'gradle',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cxx: 'cpp',
  cc: 'cpp',
  hpp: 'cpp',
  hxx: 'cpp',
  m: 'c',
  mm: 'cpp',
  java: 'java',
  jar: 'jar',
  class: 'jar',
  // Shell / scripts
  sh: 'npm', // no shell.svg, npm is a common shell icon stand-in
  bash: 'npm',
  zsh: 'npm',
  fish: 'npm',
  ps1: 'powershell',
  psm1: 'powershell',
  bat: 'powershell',
  cmd: 'powershell',
  vim: 'vim',
  // Data / config
  json: 'json',
  jsonc: 'json',
  json5: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  ini: 'editorconfig',
  env: 'lock', // generic key/value indicator
  xml: 'xml',
  xsd: 'xml',
  xsl: 'xml',
  graphql: 'graphql',
  gql: 'graphql',
  csv: 'json', // tabular data indicator
  // Docs
  md: 'markdown',
  mdx: 'markdown',
  markdown: 'markdown',
  rst: 'markdown',
  tex: 'tex',
  // Notebooks / data
  ipynb: 'document', // generic doc, not perfect
  sql: 'database',
  sqlite: 'database',
  db: 'database',
  // Images (fall back to generic `image`)
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  bmp: 'image',
  ico: 'favicon',
  tif: 'image',
  tiff: 'image',
  svg: 'svg',
  // Media
  mp3: 'audio',
  wav: 'audio',
  flac: 'audio',
  ogg: 'audio',
  m4a: 'audio',
  mp4: 'video',
  mov: 'video',
  mkv: 'video',
  webm: 'video',
  avi: 'video',
  m4v: 'video',
  // Archives / binaries
  zip: 'zip',
  tar: 'zip',
  gz: 'zip',
  tgz: 'zip',
  bz2: 'zip',
  xz: 'zip',
  '7z': 'zip',
  rar: 'zip',
  whl: 'zip',
  egg: 'zip',
  gem: 'zip',
  deb: 'zip',
  rpm: 'zip',
  dmg: 'zip',
  iso: 'zip',
  exe: 'exe',
  dll: 'dll',
  so: 'lib',
  dylib: 'lib',
  bin: 'exe',
  lib: 'lib',
  a: 'lib',
  o: 'lib',
  wasm: 'lib',
  // Lockfiles
  lock: 'lock',
  // Build / tooling
  dockerignore: 'docker',
  gitignore: 'git',
  gitattributes: 'git',
  eslintrc: 'eslint',
  prettierrc: 'prettier',
};

/** Compound-suffix patterns (matched as the path's tail, case-insensitive). */
const COMPOUND_SUFFIX_MAP: ReadonlyArray<{ suffix: string; icon: string }> = [
  { suffix: '.d.ts', icon: 'typescript' },
  { suffix: '.d.tsx', icon: 'react_ts' },
  { suffix: '.d.mts', icon: 'typescript' },
  { suffix: '.test.ts', icon: 'typescript' },
  { suffix: '.test.tsx', icon: 'react_ts' },
  { suffix: '.spec.ts', icon: 'typescript' },
  { suffix: '.spec.tsx', icon: 'react_ts' },
];

/**
 * Resolves the icon filename (e.g. `"typescript"`) for a file path, by trying
 * exact-name matches first, then compound-suffix patterns, then the last
 * extension. Returns `undefined` when nothing matches.
 *
 * The returned name is suitable for lookup in `FILE_ICON_URLS` (it must be
 * concatenated with `.svg`).
 */
export function getFileIconName(filePath: string | undefined): string | undefined {
  if (!filePath) return undefined;

  const normalized = filePath.replace(/\\/g, '/');
  const basename = normalized.split('/').pop() ?? normalized;
  const lower = basename.toLowerCase();

  // Exact-name matches (Dockerfile, LICENSE, etc.)
  if (FILENAME_ICON_MAP[lower]) {
    return FILENAME_ICON_MAP[lower];
  }

  // Compound-suffix patterns (.d.ts, .test.tsx, etc.)
  for (const { suffix, icon } of COMPOUND_SUFFIX_MAP) {
    if (lower.endsWith(suffix)) return icon;
  }

  // Last extension after a dot
  const dotIdx = lower.lastIndexOf('.');
  if (dotIdx > 0 && dotIdx < lower.length - 1) {
    const ext = lower.slice(dotIdx + 1);
    if (EXTENSION_ICON_MAP[ext]) return EXTENSION_ICON_MAP[ext];
  }

  return undefined;
}

/**
 * Resolves the built asset URL of the file-type icon for a path, or
 * `undefined` when no icon matches the curated subset.
 */
export function getFileIconUrl(filePath: string | undefined): string | undefined {
  const name = getFileIconName(filePath);
  return name ? FILE_ICON_URLS[`${name}.svg`] : undefined;
}
