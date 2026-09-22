import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-teal-btn text-white shadow-lg shadow-teal-deep/20 hover:scale-[1.03] hover:bg-[#0d9488] hover:shadow-teal/30",
        outline:
          "border border-ink/15 bg-white/80 text-ink shadow-sm hover:-translate-y-0.5 hover:border-teal hover:text-teal-ink",
        cream:
          "bg-[#f6f1e6] text-ink shadow-lift hover:scale-[1.03] hover:bg-white",
        ghost: "text-ink hover:bg-ink/5",
        dark: "bg-teal-deep text-white hover:bg-[#08312e]",
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
