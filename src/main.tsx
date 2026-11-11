import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import RespetoPopup from './RespetoPopup.tsx';
import AvisoVencimiento from './AvisoVencimiento.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <AvisoVencimiento />
    <RespetoPopup />
  </StrictMode>,
);
