import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ServiceNotice from './ServiceNotice.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServiceNotice><App /></ServiceNotice>
  </StrictMode>,
);
