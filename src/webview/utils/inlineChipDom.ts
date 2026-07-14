/**
 * @file Inline chip DOM helper utilities for the webview prompt editor.
 * Provides functions to dynamically create inline chip nodes and insert them into a contenteditable editor.
 */

/**
 * Configuration options for creating an inline rich chip element.
 */
export interface InlineChipConfig {
  /** Unique ID of the chip */
  id: string;
  /** Type of inline chip ('file' | 'image' | 'text' | 'code-selection' | 'terminal' | 'command' | 'skill') */
  type: 'file' | 'image' | 'text' | 'code-selection' | 'terminal' | 'command' | 'skill';
  /** The CSS class name for the chip element */
  className: string;
  /** Extra HTML data attributes to associate with the element */
  attributes: Record<string, string>;
  /** The name of the codicon icon to display inside the chip */
  iconClass: string;
  /** Optional URL of a file-type SVG icon. When set, takes precedence over the codicon. */
  iconUrl?: string;
  /** The label text of the chip */
  label: string;
  /** The HTML content for the chip's custom tooltip */
  tooltipHtml: string;
}

/**
 * Creates the leading `<span class="chip-icon">` for a chip.
 *
 * When `iconUrl` is set, renders an `<img>` with the file-type SVG;
 * otherwise renders a codicon `<i>` using the provided codicon class name.
 * This is the single source of truth for chip icon DOM shape — callers
 * that need to build chip nodes by hand (e.g. `usePromptEditor`,
 * `editorRestore`) should use this helper rather than duplicating the logic.
 *
 * @param iconClass The codicon class name (without the `codicon-` prefix), used as fallback.
 * @param iconUrl Optional file-type SVG URL; takes precedence when present.
 * @returns The constructed `<span class="chip-icon">` element.
 */
function createChipIconElement(iconClass: string, iconUrl?: string): HTMLSpanElement {
  const iconSpan = document.createElement('span');
  iconSpan.className = 'chip-icon';
  if (iconUrl) {
    const img = document.createElement('img');
    img.src = iconUrl;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.draggable = false;
    img.className = 'chip-icon-img';
    iconSpan.appendChild(img);
  } else {
    const iconI = document.createElement('i');
    iconI.className = `codicon codicon-${iconClass}`;
    iconSpan.appendChild(iconI);
  }
  return iconSpan;
}

/**
 * Creates an inline HTMLSpanElement representing a rich context chip.
 *
 * @param config Configuration parameters for the inline chip.
 * @returns The constructed HTMLSpanElement.
 */
export function createInlineChipElement(config: InlineChipConfig): HTMLSpanElement {
  const chipNode = document.createElement('span');
  chipNode.className = config.className;
  chipNode.contentEditable = 'false';
  chipNode.setAttribute('data-chip-id', config.id);
  chipNode.setAttribute('data-chip-type', config.type);

  // Set attributes
  for (const [key, value] of Object.entries(config.attributes)) {
    if (value !== undefined && value !== null) {
      chipNode.setAttribute(key, value);
    }
  }

  chipNode.appendChild(createChipIconElement(config.iconClass, config.iconUrl));

  // Create label element
  const labelSpan = document.createElement('span');
  labelSpan.className = 'chip-label';
  labelSpan.textContent = config.label;
  chipNode.appendChild(labelSpan);

  // Set tooltip attribute
  chipNode.setAttribute('data-custom-title', config.tooltipHtml);

  return chipNode;
}

/**
 * Inserts a constructed inline chip element into the contenteditable editor
 * at the specific selection/range matching the query trigger location.
 *
 * @param chipNode The pre-constructed chip span element.
 * @param textNode The text node containing the query trigger character.
 * @param startOffset The start character offset of the trigger in the text node.
 * @param insertTrailingSpace Whether to insert a normal space after the inserted chip.
 */
export function insertInlineChipNode(
  chipNode: HTMLSpanElement,
  textNode: Node,
  startOffset: number,
  insertTrailingSpace: boolean = false,
): void {
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  try {
    range.setStart(textNode, startOffset);
    const currentRange = selection.getRangeAt(0);
    range.setEnd(textNode, currentRange.startOffset);
  } catch (e) {
    console.error('Failed to set range for inline chip insertion:', e);
    return;
  }

  // Replace trigger text range with the chip node
  range.deleteContents();
  range.insertNode(chipNode);

  // Position selection cursor after the inserted chip
  const newRange = document.createRange();
  newRange.setStartAfter(chipNode);
  newRange.setEndAfter(chipNode);
  selection.removeAllRanges();
  selection.addRange(newRange);

  // Add trailing space if requested (e.g. for commands so parameters can be typed)
  if (insertTrailingSpace) {
    const spaceNode = document.createTextNode(' ');
    newRange.insertNode(spaceNode);
    const afterSpace = document.createRange();
    afterSpace.setStartAfter(spaceNode);
    afterSpace.setEndAfter(spaceNode);
    selection.removeAllRanges();
    selection.addRange(afterSpace);
  }
}
