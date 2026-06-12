// Toast context lives outside ui.tsx so component files only export components
// (keeps React fast-refresh happy).

import { createContext, useContext } from 'react';

export type ToastTone = 'default' | 'success' | 'error';

export const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}
