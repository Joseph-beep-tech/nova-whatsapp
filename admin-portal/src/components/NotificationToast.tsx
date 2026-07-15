import { X, Package, Bike, AlertTriangle } from 'lucide-react';

export type ToastType = 'new-order' | 'rider-assigned' | 'no-rider';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  orderId?: string;
}

interface Props {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  onAccept: (toast: ToastItem) => void;
}

const ICONS: Record<ToastType, typeof Package> = {
  'new-order': Package,
  'rider-assigned': Bike,
  'no-rider': AlertTriangle,
};

export default function NotificationToastStack({ toasts, onDismiss, onAccept }: Props) {
  if (!toasts.length) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      {toasts.map((t) => {
        const Icon = ICONS[t.type];
        return (
          <div
            key={t.id}
            className="card-sm shadow-card-hover flex items-start gap-3 fade-in bg-white pointer-events-auto"
          >
            <div className="p-2 rounded-lg bg-gold-50 text-gold-600 shrink-0">
              <Icon size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{t.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t.message}</p>
              {t.type === 'new-order' && (
                <button onClick={() => onAccept(t)} className="btn-primary text-xs px-3 py-1.5 mt-2">
                  Accept
                </button>
              )}
            </div>
            <button onClick={() => onDismiss(t.id)} className="text-gray-400 hover:text-gray-700 shrink-0">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
