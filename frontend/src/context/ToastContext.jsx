import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, tone = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-[min(100%-2rem,24rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm font-medium shadow-card ${
              toast.tone === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-pine-100 bg-white text-pine-900'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
