/**
 * @file Webview application entry point.
 * Mounts the React App component into the DOM and imports global styles.
 */

import '@vscode/codicons/dist/codicon.css';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
