import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { applyCssVariables } from './theme/colors';
import { initWebApp } from './telegram/webapp';
// Шрифты отдаются с того же домена, что и приложение: без запросов к Google
// (приватность) и без блокирующего стиля со стороннего сервера (скорость).
// В каждом файле @font-face с unicode-range — браузер скачает только нужные
// поднаборы (латиница, кириллица, расширенная латиница для МФА).
import '@fontsource-variable/literata/opsz.css';
import '@fontsource/golos-text/400.css';
import '@fontsource/golos-text/500.css';
import '@fontsource/golos-text/600.css';
import '@fontsource/golos-text/700.css';
import './theme/global.css';

applyCssVariables();
initWebApp();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
