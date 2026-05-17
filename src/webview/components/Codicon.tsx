/**
 * @file Reusable React component for parsing and rendering VS Code Codicon icons.
 */

import type { CSSProperties } from 'react';

/** Props for the Codicon component. */
export interface CodiconProps {
  /**
   * The icon identifier. Supports raw names (e.g., 'shield') or VS Code syntax
   * (e.g., '$(shield)', '$(sync~spin)').
   */
  name: string;
  /** Optional custom CSS class names to merge with the codicon classes. */
  className?: string;
  /** Optional inline styles to customize colors, sizes, etc. */
  style?: CSSProperties;
}

/**
 * Renders a VS Code Codicon icon using standard VS Code CSS classes.
 * Parses strings like `$(shield)` or `$(sync~spin)` into appropriate classes.
 */
export function Codicon({ name, className = '', style }: CodiconProps) {
  const trimmed = name.trim();
  if (!trimmed) {
    return null;
  }

  let iconName: string;
  let modifier: string | undefined;

  // Check if the name conforms to VS Code's $(iconName[~modifier]) syntax
  const match = trimmed.match(/^\$\(([^)]+)\)$/);
  if (match) {
    const content = match[1];
    // Modifiers in VS Code can be appended with a tilde (e.g. sync~spin)
    const parts = content.split('~');
    iconName = parts[0];
    modifier = parts[1];
  } else {
    // If not enclosed in $(), try to parse a direct modifier tilde split
    const parts = trimmed.split('~');
    iconName = parts[0];
    modifier = parts[1];
  }

  // Build the list of class names according to the codicon stylesheet spec
  const classes = ['codicon', `codicon-${iconName}`];

  if (modifier) {
    // VS Code codicon animations use class pattern `codicon-modifier-[modifier]`
    classes.push(`codicon-modifier-${modifier}`);
  }

  if (className) {
    classes.push(className);
  }

  return <span className={classes.join(' ')} style={style} />;
}
