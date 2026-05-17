---
version: alpha
name: VS Code Fluent
description: 'VS Code native client design system with dynamic theme adaptability'
colors:
  primary: '#0e639c'
  secondary: '#3c3c3c'
  tertiary: '#4daafc'
  neutral: '#1e1e1e'
  surface: '#252526'
  on-surface: '#cccccc'
  error: '#f48771'
typography:
  body-md:
    fontFamily: system-ui
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
  headline-md:
    fontFamily: system-ui
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.3
  label-sm:
    fontFamily: monospace
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1.2
rounded:
  sm: 4px
  md: 6px
  lg: 8px
  full: 9999px
spacing:
  base: 16px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '#ffffff'
    rounded: '{rounded.sm}'
    padding: 8px
  input-text:
    backgroundColor: '{colors.secondary}'
    textColor: '{colors.on-surface}'
    rounded: '{rounded.sm}'
    padding: 6px
---

# DESIGN.md - VS Code OpenCode Client Design System

This document outlines the design tokens, rules, components, and styling rationale for the OpenCode VS Code client. It ensures visual consistency, engineered precision, and robust theme-adaptability inside the VS Code extension environment.

## Overview

The OpenCode VS Code client is designed to feel like a first-party, natural extension of the VS Code editor. It respects user preferences, panel layouts, and active editor themes.

### Brand & Style Guidelines

- **Integration**: The interface behaves as a cohesive workspace sidebar or editor panel. It does not introduce competing UI styles.
- **Theme Adaptability**: Color schemes are fully dynamic. Using native VS Code theme variables ensures that any developer-selected theme (Dark+, Light+, GitHub Light, Cyberpunk, High Contrast) will be inherited perfectly.
- **Component Toolkit**: Interactive components are built using the official `@vscode/webview-ui-toolkit` to preserve standard VS Code form controls.

---

## Colors

To achieve first-class dynamic theming, **do not hardcode color values in CSS files**. Instead, bind theme configurations directly to native VS Code CSS variables, utilizing the tokens below as default fallbacks.

- **Primary (#0e639c):** Used for prominent action buttons, active progress bars, and critical highlights.
  - Maps to: `var(--vscode-button-background)` / `var(--vscode-progressBar-background)`
- **Secondary (#3c3c3c):** Used for auxiliary container backgrounds such as inputs and inactive states.
  - Maps to: `var(--vscode-input-background)`
- **Tertiary (#4daafc):** The main anchor link and interaction accent color.
  - Maps to: `var(--vscode-textLink-foreground)` / `var(--vscode-textLink-activeForeground)`
- **Neutral (#1e1e1e):** The base background for the overall app and core content area.
  - Maps to: `var(--vscode-editor-background)`
- **Surface (#252526):** Elevated background layers (widget overlays, dropdown dialogs, headers).
  - Maps to: `var(--vscode-editor-widget-background)`
- **On-Surface (#cccccc):** Primary body text color, ensuring high legibility.
  - Maps to: `var(--vscode-editor-foreground)` / `var(--vscode-input-foreground)`
- **Error (#f48771):** Warning states, error text, and failed execution highlights.
  - Maps to: `var(--vscode-error-foreground)`

### Dynamic Mappings in CSS

For absolute integration, write styles utilizing variables as shown:

```css
body {
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
}

.tab.active {
  background-color: var(--vscode-list-activeSelectionBackground);
}
```

---

## Typography

Typography inherits the user's active editor configuration. This minimizes visual friction when shifting focus from the editor to the panel.

- **Standard Font Family:** Managed by `var(--vscode-font-family)` which automatically falls back to `system-ui, -apple-system, sans-serif`.
- **Monospace Font Family:** Inherited from `var(--vscode-editor-font-family)` for code fragments, reasoning contents, and terminal outputs.
- **Base Font Size:** Bound to `var(--vscode-font-size)` (defaults to `13px`).

### Typography Levels

- **headline-md**: Headers, titles, and section dividers. Size: `16px`, weight: `600`, line height: `1.3`.
- **body-md**: Standard message chat text. Size: `13px`, weight: `400`, line height: `1.4`.
- **label-sm**: Metadata, badges, and headers of assistant sub-components. Size: `11px`, weight: `600` (uppercase), letter spacing: `0.05em`.

---

## Layout

Layout spacing uses a **strict 8px system** (with a 4px half-step for micro-adjustments) to align elements perfectly.

### Grid & Panel Structure

- **Container (.app)**: Occupies exactly `100vh` and uses `overflow: hidden` to block outer scrollbars.
- **Tabs Bar (.session-tabs)**: Spans the top full width. Fits horizontally-scrolling tabs inside a single line.
- **Chat viewport (.chat-view)**: Scrollable vertical list using a flex column container with `gap: 16px`.
- **Prompt Input Area (.prompt-input)**: Fixed to the bottom, ensuring it remains easily accessible without blocking chat messages.

---

## Elevation & Depth

VS Code uses a flat, border-oriented design system. Rather than using large, fuzzy shadows, depth and hierarchy are constructed through solid borders and opacity tint layers.

- **Borders**: Defined as `1px solid var(--vscode-border-color)` (which inherits `var(--vscode-editor-widget-border, #454545)`).
- **Opacity Tints**: Leverage CSS `color-mix()` to tint surfaces without breaking contrast:
  - User message box: `background-color: color-mix(in srgb, var(--vscode-textLink-foreground) 10%, transparent)`
  - Sub-tool headers: `background-color: color-mix(in srgb, var(--vscode-editor-widget-background) 80%, transparent)`
- **Shadows**: Reserved strictly for overlays (like `.settings-panel`) using `box-shadow: -4px 0 16px rgba(0, 0, 0, 0.3)`.

---

## Shapes

Shapes follow the **Fluent Design** style with minimal corner rounding:

- **sm (4px)**: Input elements, tabs, pills, and basic action buttons.
- **md (6px)**: Nested container segments (tool blocks, reasoning headers, pre-code logs).
- **lg (8px)**: Primary chat message balloons and permission boxes.
- **full (9999px)**: Circular status tags, online indicators, and indicators.

---

## Components

Design specifications for standard interactive elements:

### 1. Buttons

- Primary buttons use `var(--vscode-button-background)` and inherit `:hover` scale.
- Padding is set to `8px 16px` for standard elements.

### 2. Tabs (.tab)

- Translucent background, turning to `--vscode-list-hoverBackground` on hover.
- Active state matches `--vscode-list-activeSelectionBackground` with fully readable white text.

### 3. Collapsible Containers (.reasoning-part)

- Header background uses 80% widget background.
- Font inherits monospace layout, collapsible content is padded by `12px` and uses `--vscode-border-color`.

### 4. Input Fields (vscode-text-area, vscode-text-field)

- Integrates directly into bottom bar layout.
- Border radius set to `4px`.
- Text wraps properly inside text-area inputs without overflow.

---

## Do's and Don'ts

### Do's

- **Do** always verify WCAG compliance by utilizing CSS variables.
- **Do** use the official `@vscode/webview-ui-toolkit` widgets for interactive forms.
- **Do** make sure monospace content handles long string wrapped margins properly.
- **Do** test user interactions in both high-contrast light and dark themes.

### Don'ts

- **Don't** use absolute colors like `#ffffff` or `#000000` for backgrounds or texts.
- **Don't** insert heavy drop-shadows on standard chat components or container components.
- **Don't** enforce static pixel sizes for font-families or font-sizes that ignore VS Code settings.
- **Don't** mix multiple corner radii configurations within a single element grouping.
