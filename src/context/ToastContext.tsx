// TEAM_005: ToastContext 已重構為 NotificationContext (此處為向下相容適配器)
import React, { createContext, ReactNode } from 'react';
import { useNotification } from './NotificationContext';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

export const ToastContext = createContext<ToastContextType>({
  showToast: () => {}
});

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { notify } = useNotification();

  const showToast = (message: string, type: ToastType = 'info') => {
    const mappedType = type === 'error' ? 'danger' : type;
    notify({ message, type: mappedType });
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
    </ToastContext.Provider>
  );
};
