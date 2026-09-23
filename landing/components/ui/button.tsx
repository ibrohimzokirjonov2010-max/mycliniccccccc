import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1760ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#07090f] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[#1760ff] text-white shadow-[0_12px_32px_-16px_rgba(23,96,255,0.95)] hover:bg-[#3c7dff]",
        outline: "border border-white/15 bg-white/[0.03] text-white hover:border-[#1760ff]/70 hover:bg-white/[0.06]",
        cream: "border border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08]",
        ghost: "text-[#d5deea] hover:bg-white/5",
        dark: "border border-white/15 bg-[#0e1524] text-white hover:border-[#1760ff]/60",
      },
      size: {
        default: "h-11 px-5 text-sm",
        lg: "h-14 px-7 text-base",
        xl: "h-16 px-10 text-lg",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
