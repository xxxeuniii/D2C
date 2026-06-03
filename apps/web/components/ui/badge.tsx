"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-brand-primary/10 text-brand-primary border border-brand-primary/20",
        secondary:
          "bg-bg-elevated text-text-secondary border border-border",
        success:
          "bg-status-success/10 text-status-success border border-status-success/20",
        warning:
          "bg-status-warning/10 text-status-warning border border-status-warning/20",
        error:
          "bg-status-error/10 text-status-error border border-status-error/20",
        info: "bg-status-info/10 text-status-info border border-status-info/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
