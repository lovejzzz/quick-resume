"use client";

import { useEffect, useRef } from "react";

export type ConfirmationRequest = {
  confirmLabel: string;
  eyebrow: string;
  message: string;
  onConfirm: () => void;
  title: string;
  tone: "accent" | "danger";
};

export type ConfirmationDialogProps = {
  onCancel: () => void;
  onConfirm: () => void;
  request: ConfirmationRequest | null;
};

export function ConfirmationDialog({ onCancel, onConfirm, request }: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!request) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const frame = window.requestAnimationFrame(() => cancelRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [request]);

  if (!request) return null;

  return (
    <dialog
      aria-labelledby="confirmation-title"
      className={`confirmation-dialog no-print tone-${request.tone}`}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      ref={dialogRef}
    >
      <div className="confirmation-heading">
        <span aria-hidden="true" className="confirmation-symbol">
          <i />
          <i />
        </span>
        <div>
          <p className="eyebrow">{request.eyebrow}</p>
          <h2 id="confirmation-title">{request.title}</h2>
        </div>
      </div>
      <p className="confirmation-message">{request.message}</p>
      <div className="confirmation-actions">
        <button className="confirmation-cancel" onClick={onCancel} ref={cancelRef} type="button">
          Keep editing
        </button>
        <button className="confirmation-accept" onClick={onConfirm} type="button">
          {request.confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
