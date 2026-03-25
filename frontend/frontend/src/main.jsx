import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import './index.css';

// 🔥 Aumentamos la memoria a 5 minutos y evitamos recargas innecesarias al cambiar de menú
const qc = new QueryClient({
  defaultOptions: { 
    queries: { 
      retry: 1, 
      staleTime: 300000, // 300,000 ms = 5 minutos
      refetchOnWindowFocus: false,
      refetchOnMount: false // Evita pedir datos de nuevo solo por cambiar de página en el menú
    } 
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <App/>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
