import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { captureAttribution } from './services/attribution';
import { setupPwa } from './services/pwa';

// Guarda a origem do visitante (link de anúncio, Instagram, Google…) para o agendamento.
captureAttribution();
// App instalável: ícone na tela do celular e abertura rápida.
setupPwa();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
