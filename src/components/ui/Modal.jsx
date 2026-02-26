import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import Card from './Card';
import Button from './Button';

const Modal = ({ open, title, onClose, children, maxWidth = 'max-w-lg' }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className={`w-full ${maxWidth} p-0`}>
        <div className="flex items-center justify-between border-b border-app-border px-5 py-4">
          <h3>{title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close modal">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-5">{children}</div>
      </Card>
    </div>
  );
};

export default Modal;
