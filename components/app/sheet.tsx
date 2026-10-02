"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useT } from "./locale";

/** Native modal dialog: focus trap, Escape and inert background come from the browser. Bottom sheet on phones, centered card on desktop. */
export function Sheet({ open, onClose, title, description, children, className = "" }: {
  open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode; className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useT();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} className={`sheet ${className}`} aria-labelledby="sheet-title" onClose={onClose}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="sheet-body">
      <span className="sheet-grip" aria-hidden="true" />
      <header className="sheet-head">
        <div><h2 id="sheet-title">{title}</h2>{description && <p>{description}</p>}</div>
        <button className="icon-btn" onClick={onClose} aria-label={t.shell.close}><X size={20} /></button>
      </header>
      {open && children}
    </div>
  </dialog>;
}
