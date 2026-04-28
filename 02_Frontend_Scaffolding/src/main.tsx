import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { msalInstance } from './config/msalConfig';

// MSAL Browser v3 requires explicit async initialization before first render.
msalInstance.initialize().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}).catch((err) => {
  // MSAL init failure (e.g. placeholder client ID) — still render the app
  // SSO will be unavailable but email/password login still works
  console.warn('[MSAL] Init failed — SSO unavailable:', err.message);
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
