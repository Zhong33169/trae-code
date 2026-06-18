import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

export interface ToastData {
  type: "success" | "error" | "info";
  msg: string;
}

export function Toast({ toast }: { toast: ToastData | null }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (toast) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [toast]);

  if (!toast) return null;

  const styles = {
    success: {
      bg: "bg-emerald-ok",
      icon: <CheckCircle2 className="w-5 h-5" />,
    },
    error: {
      bg: "bg-crimson",
      icon: <AlertTriangle className="w-5 h-5" />,
    },
    info: {
      bg: "bg-deep-500",
      icon: <Info className="w-5 h-5" />,
    },
  }[toast.type];

  return (
    <div
      className={`fixed top-16 right-6 z-50 ${styles.bg} text-white rounded shadow-lg px-4 py-3 flex items-center gap-2 max-w-md transition-all ${
        visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
      }`}
    >
      {styles.icon}
      <span className="text-sm font-medium">{toast.msg}</span>
    </div>
  );
}
