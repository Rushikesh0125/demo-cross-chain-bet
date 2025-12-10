import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType, opts?: { durationMs?: number }) => void;
  success: (message: string, opts?: { durationMs?: number }) => void;
  error: (message: string, opts?: { durationMs?: number }) => void;
  info: (message: string, opts?: { durationMs?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutsRef = useRef<Record<string, any>>({});

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timeoutsRef.current[id]) {
      clearTimeout(timeoutsRef.current[id]);
      delete timeoutsRef.current[id];
    }
  }, []);

  const showBase = useCallback((message: string, type: ToastType = "info", opts?: { durationMs?: number }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const toast: ToastItem = { id, message, type };
    setToasts((prev) => [...prev, toast]);
    const duration = opts?.durationMs ?? 3500;
    timeoutsRef.current[id] = setTimeout(() => remove(id), duration);
  }, [remove]);

  const value = useMemo<ToastContextValue>(() => {
    return {
      show: showBase,
      success: (m, opts) => showBase(m, "success", opts),
      error: (m, opts) => showBase(m, "error", opts),
      info: (m, opts) => showBase(m, "info", opts),
    };
  }, [showBase]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed top-6 right-6 z-50 flex flex-col gap-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              "pointer-events-auto min-w-[320px] max-w-[560px] rounded-lg border px-5 py-4 shadow-xl transition-all",
              t.type === "success" ? "bg-green-50 border-green-200 text-green-900" : "",
              t.type === "error" ? "bg-red-50 border-red-200 text-red-900" : "",
              t.type === "info" ? "bg-gray-50 border-gray-200 text-gray-900" : "",
            ].join(" ")}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-4">
              <div className="mt-1.5">
                {t.type === "success" ? (
                  <span className="inline-block h-3.5 w-3.5 rounded-full bg-green-500"></span>
                ) : t.type === "error" ? (
                  <span className="inline-block h-3.5 w-3.5 rounded-full bg-red-500"></span>
                ) : (
                  <span className="inline-block h-3.5 w-3.5 rounded-full bg-gray-500"></span>
                )}
              </div>
              <div className="flex-1 text-base leading-relaxed">{t.message}</div>
              <button
                onClick={() => remove(t.id)}
                className="ml-2 rounded px-2 py-1 text-sm text-gray-700 hover:bg-black/5"
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}


