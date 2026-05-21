/**
 * @file Utility helpers for parsing and rendering inline attachment chips in Markdown.
 */

import type { Part } from '@opencode-ai/sdk/v2/client';
import React from 'react';
import { Chip } from '../components/Chip';
import { parseFilenameLineRange, parseFileUrl } from './chipUtils';

/**
 * Determines the rendering type of a file chip based on attributes and source metadata.
 *
 * @param chipType The parsed type of the chip.
 * @param matchedPart The matching SDK Part data.
 * @returns The resolved chip type identifier.
 */
export function getChipTypeToRender(
  chipType: string,
  matchedPart: Extract<Part, { type: 'file' }>,
): 'file' | 'image' | 'code-selection' | 'terminal' {
  const isImage =
    chipType === 'Image' ||
    matchedPart.mime?.startsWith('image/') ||
    matchedPart.url?.startsWith('data:image/');

  if (isImage) {
    return 'image';
  }

  if (
    chipType === 'Terminal' ||
    matchedPart.filename?.startsWith('terminal [') ||
    (matchedPart.source &&
      (matchedPart.source.type === 'file' || matchedPart.source.type === 'symbol') &&
      matchedPart.source.path.startsWith('terminal-'))
  ) {
    return 'terminal';
  }

  if (
    matchedPart.mime !== 'directory' &&
    matchedPart.mime !== 'application/x-directory' &&
    (chipType === 'Code Selection' || parseFilenameLineRange(matchedPart.filename))
  ) {
    return 'code-selection';
  }

  return 'file';
}

/**
 * Renders a matched inline chip based on pre-indexed lookup maps.
 *
 * @param chipType The parsed type identifier of the chip.
 * @param chipName The parsed filename or display label of the chip.
 * @param partsByFilename Pre-indexed file parts mapping filename to Part.
 * @param partsByTextFilename Pre-indexed text parts mapping filename to Part.
 * @param partsByImageFilename Pre-indexed image parts mapping filename to Part.
 * @param partsByTerminalFilename Pre-indexed terminal parts mapping filename to Part.
 * @param partsByCommandName Pre-indexed command text parts mapping command name to Part.
 * @param partsBySkillName Pre-indexed skill text parts mapping skill name to Part.
 * @param keyIdx Unique React key index.
 */
export function parseAndRenderInlineChip(
  chipType: string,
  chipName: string,
  partsByFilename: Map<string, Part>,
  partsByTextFilename: Map<string, Part>,
  partsByImageFilename: Map<string, Part>,
  partsByTerminalFilename: Map<string, Part>,
  partsByCommandName: Map<string, Part>,
  partsBySkillName: Map<string, Part>,
  keyIdx: number,
): React.ReactNode | null {
  let matchedPart: Part | undefined;
  if (chipType === 'File' || chipType === 'Code Selection') {
    matchedPart = partsByFilename.get(chipName);
  } else if (chipType === 'Text') {
    matchedPart = partsByTextFilename.get(chipName);
  } else if (chipType === 'Image') {
    matchedPart = partsByImageFilename.get(chipName);
  } else if (chipType === 'Terminal') {
    matchedPart =
      partsByTerminalFilename.get(`terminal [${chipName}]`) || partsByFilename.get(chipName);
  } else if (chipType === 'Command') {
    matchedPart = partsByCommandName.get(chipName);
  } else if (chipType === 'Skill') {
    matchedPart = partsBySkillName.get(chipName);
  }

  if (!matchedPart) return null;

  if (chipType === 'Text' && matchedPart.type === 'text') {
    const meta = matchedPart.metadata as { filename?: string; linesCount?: number } | undefined;
    return (
      <span key={`chip-${keyIdx}`} className="opencode-chip-inline-wrapper">
        <Chip
          type="text"
          filename={meta?.filename || chipName}
          text={matchedPart.text}
          linesCount={meta?.linesCount}
        />
      </span>
    );
  }

  if (chipType === 'Command' && matchedPart.type === 'text') {
    const meta = matchedPart.metadata as { command?: string; source?: string } | undefined;
    return (
      <span key={`chip-${keyIdx}`} className="opencode-chip-inline-wrapper">
        <Chip type="command" filename={meta?.command || chipName} mime={meta?.source} />
      </span>
    );
  }

  if (chipType === 'Skill' && matchedPart.type === 'text') {
    const meta = matchedPart.metadata as { name?: string } | undefined;
    return (
      <span key={`chip-${keyIdx}`} className="opencode-chip-inline-wrapper">
        <Chip type="skill" filename={meta?.name || chipName} text={matchedPart.text} />
      </span>
    );
  }

  if (matchedPart.type === 'file') {
    const chipTypeToRender = getChipTypeToRender(chipType, matchedPart);
    const isImage = chipTypeToRender === 'image';

    const sourcePath =
      matchedPart.source &&
      (matchedPart.source.type === 'file' || matchedPart.source.type === 'symbol')
        ? matchedPart.source.path
        : undefined;
    let resolvedPath = sourcePath;
    let decodedText: string | undefined;
    const url = matchedPart.url;

    if (!isImage && url) {
      const parsed = parseFileUrl(url, matchedPart.mime);
      resolvedPath = resolvedPath || parsed.path;
      decodedText = parsed.text;
    }

    if (
      !decodedText &&
      matchedPart.source &&
      matchedPart.source.type === 'file' &&
      matchedPart.source.text
    ) {
      decodedText = matchedPart.source.text.value;
    }

    let startLine: number | undefined;
    let endLine: number | undefined;
    let linesCount: number | undefined;
    const filenameRange = parseFilenameLineRange(matchedPart.filename);

    if (chipTypeToRender === 'code-selection') {
      startLine = filenameRange?.startLine;
      endLine = filenameRange?.endLine;
      if (matchedPart.source && matchedPart.source.type === 'file' && matchedPart.source.text) {
        startLine = startLine ?? matchedPart.source.text.start;
        endLine = endLine ?? matchedPart.source.text.end;
      }
    } else if (
      chipTypeToRender === 'terminal' &&
      matchedPart.source &&
      matchedPart.source.type === 'file' &&
      matchedPart.source.text
    ) {
      linesCount = matchedPart.source.text.end;
    }

    return (
      <span key={`chip-${keyIdx}`} className="opencode-chip-inline-wrapper">
        <Chip
          type={chipTypeToRender}
          filename={matchedPart.filename}
          path={resolvedPath}
          mime={matchedPart.mime}
          dataUrl={isImage ? url : undefined}
          text={decodedText}
          startLine={startLine}
          endLine={endLine}
          linesCount={linesCount}
        />
      </span>
    );
  }

  return null;
}
