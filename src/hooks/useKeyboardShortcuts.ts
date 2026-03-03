import { useEffect, useCallback } from "react";

interface ShortcutHandlers {
  onNext?: () => void;
  onPrev?: () => void;
  onApprove?: () => void;
  onDismiss?: () => void;
  onModify?: () => void;
}

export const useKeyboardShortcuts = (handlers: ShortcutHandlers, enabled = true) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger in inputs/textareas
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case "j":
          e.preventDefault();
          handlers.onNext?.();
          break;
        case "k":
          e.preventDefault();
          handlers.onPrev?.();
          break;
        case "a":
          e.preventDefault();
          handlers.onApprove?.();
          break;
        case "d":
          e.preventDefault();
          handlers.onDismiss?.();
          break;
        case "m":
          e.preventDefault();
          handlers.onModify?.();
          break;
      }
    },
    [handlers]
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown, enabled]);
};
