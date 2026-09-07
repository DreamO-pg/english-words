import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyCssVariables } from './theme/colors';
import { initWebApp } from './telegram/webapp';
import './theme/global.css';

applyCssVariables();
initWebApp();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
