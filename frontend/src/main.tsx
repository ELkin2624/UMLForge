// Debe ser el primer import: crypto.randomUUID no existe por HTTP sin TLS.
import './shared/polyfills/crypto-polyfill.ts';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './style.css';
import '@xyflow/react/dist/style.css'; // Evita ResizeObserver loop de React Flow
import '@tumaet/apollon/style.css'; // CRÍTICO: Estilos nativos de Apollon 5.x

createRoot(document.getElementById('app')!).render(
  <App />
);
