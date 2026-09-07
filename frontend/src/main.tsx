import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './style.css';
import '@xyflow/react/dist/style.css'; // Evita ResizeObserver loop de React Flow
import '@tumaet/apollon/style.css'; // CRÍTICO: Estilos nativos de Apollon 5.x

createRoot(document.getElementById('app')!).render(
  <App />
);
