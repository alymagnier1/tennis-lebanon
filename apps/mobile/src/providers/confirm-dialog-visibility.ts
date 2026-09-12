import { createContext, useContext } from "react";

/**
 * Tiny module so AppUi (and other leaf UI) can know a confirm dialog is open
 * without importing ConfirmDialogProvider — that provider pulls button chrome
 * which eventually imports AppUi and would close a require cycle.
 */
export const ConfirmDialogVisibilityContext = createContext<{
  visible: boolean;
} | null>(null);

export function useConfirmDialogVisible(): boolean {
  const ctx = useContext(ConfirmDialogVisibilityContext);
  return ctx?.visible ?? false;
}
