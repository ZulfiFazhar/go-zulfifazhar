import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

// ponytail: asChild slot skipped, add if polymorphic button composition needed.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5e1f] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-[#ff5e1f] text-white hover:bg-[#e65016] shadow-sm",
        primary: "bg-[#ff5e1f] text-white hover:bg-[#e65016] shadow-sm",
        secondary: "bg-[#262626] text-white hover:bg-[#383838]",
        outline: "border border-[#f0f0f0] bg-white text-[#262626] hover:bg-[#f7f7f7]",
        ghost: "text-[#262626] hover:bg-[#f7f7f7]",
        soft: "bg-[#ffefe8] text-[#ff5e1f] hover:bg-[#ffd9cb]",
        white: "bg-white text-[#262626] hover:bg-[#f7f7f7] shadow-sm",
        link: "text-[#ff5e1f] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[50px] px-6 py-2.5",
        sm: "h-9 px-4 text-sm",
        lg: "h-[50px] px-8 text-lg",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
