import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, AlertCircle } from 'lucide-react';

interface ToastProps {
  show: boolean;
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose?: () => void;
}

export function Toast({ show, message, type = 'success', duration = 2500, onClose }: ToastProps) {
  useEffect(() => {
    if (show && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);

  const icons = {
    success: <Check size={16} className="text-[--success]" />,
    error: <X size={16} className="text-[--error]" />,
    info: <AlertCircle size={16} className="text-[--accent]" />,
  };

  const bgColors = {
    success: 'bg-[--success-soft] border-[--success]',
    error: 'bg-[--error-soft] border-[--error]',
    info: 'bg-[--accent-soft] border-[--accent]',
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 10, x: '-50%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`
            fixed bottom-6 left-1/2 z-50
            flex items-center gap-2
            px-4 py-3
            border-[1.5px] ${bgColors[type]}
            rounded-xl
            shadow-lg
            font-body text-sm font-medium
          `}
        >
          {icons[type]}
          <span>{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface ToastState {
  show: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

export function useToast() {
  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: '',
    type: 'success',
  });

  const showToast = (message: string, type: ToastState['type'] = 'success') => {
    setToast({ show: true, message, type });
  };

  const hideToast = () => {
    setToast(prev => ({ ...prev, show: false }));
  };

  return { toast, showToast, hideToast };
}
