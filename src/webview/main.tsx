/**
 * @file Webview application entry point.
 * Routes to either the ReviewPage (when __OPENCODE_CONFIG__.reviewID is present) or the main App.
 * Imports global styles and codicon CSS.
 */

import '@vscode/codicons/dist/codicon.css';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ReviewPage } from './components/ReviewPage';
import './styles.css';

declare global {
  interface Window {
    __OPENCODE_CONFIG__?: { reviewID?: string };
  }
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);

  // Check for reviewID injected by the extension host via __OPENCODE_CONFIG__
  const reviewID = window.__OPENCODE_CONFIG__?.reviewID;

  if (reviewID) {
    root.render(<ReviewPage reviewID={reviewID} />);
  } else {
    root.render(<App />);
  }
}
