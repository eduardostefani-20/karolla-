import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { captureAttribution } from './services/attribution';

// Guarda a origem do visitante (link de anúncio, Instagram, Google…) para o agendamento.
captureAttribution();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
