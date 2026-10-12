import { createContext, useCallback, useContext, useState } from 'react';

const ConfirmContext = createContext(() => Promise.resolve(false));

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        setState({ ...options, resolve });
      }),
    []
  );

  function close(result) {
    state?.resolve(result);
    setState(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="card w-full max-w-md p-5" role="dialog" aria-modal="true">
            <h2 className="text-lg font-bold">{state.title}</h2>
            <p className="mt-2 text-sm text-stone-600">{state.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => close(false)} type="button">
                Cancel
              </button>
              <button className={state.danger ? 'btn-danger' : 'btn-primary'} onClick={() => close(true)} type="button">
                {state.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
