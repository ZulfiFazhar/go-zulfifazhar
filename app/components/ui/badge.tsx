import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#ff5e1f] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-[#ff5e1f] text-white shadow-sm",
        secondary: "bg-[#ffefe8] text-[#ff5e1f]",
        outline: "border border-[#f0f0f0] text-[#262626] bg-white",
        dark: "bg-[#262626] text-white",
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
