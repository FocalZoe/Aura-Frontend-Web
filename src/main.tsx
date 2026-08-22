import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { SocketProvider } from './context/SocketContext.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { NotificationProvider } from './context/NotificationContext.tsx';

// TEAM_005: 以 NotificationProvider 完全替代舊有 ToastProvider
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <SocketProvider>
            <App />
          </SocketProvider>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
