// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import './index.css';

// 🔥 Motor optimizado: Rápido, estable y seguro para trabajo colaborativo
const qc = new QueryClient({
  defaultOptions: { 
    queries: { 
      retry: 1, // Si falla la red, no congela la app intentando infinitamente
      staleTime: 300000, // 5 minutos de memoria fresca para navegar súper rápido
      refetchOnWindowFocus: false, // Evita asfixiar la base de datos al cambiar de pestaña en Chrome
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
