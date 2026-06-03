"use client";

import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Check, X } from "lucide-react";

interface HumanConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function HumanConfirmModal({
  open,
  title,
  description,
  onConfirm,
  onCancel,
}: HumanConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md animate-fade-in rounded-xl border border-border bg-bg-surface p-6 shadow-lg">
        {/* Icon */}
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-status-warning/10">
          <AlertTriangle className="h-6 w-6 text-status-warning" />
        </div>

        {/* Content */}
        <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
        <p className="mt-2 text-sm text-text-secondary">{description}</p>

        {/* Actions */}
        <div className="mt-6 flex gap-3 justify-end">
          <Button variant="secondary" onClick={onCancel} className="gap-2">
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={onConfirm} className="gap-2">
            <Check className="h-4 w-4" />
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}
