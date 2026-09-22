import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props} />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

// Avtomatik X tugmasi olib tashlangan - har bir modal o'z yopish tugmasini boshqaradi
const DialogContent = React.forwardRef(({ className, children, style, ...props }, ref) => {
  const classStr = typeof className === 'string' ? className : '';
  const columnLayout = classStr.includes('payment-add-dialog');
  // Fluid shells (payment / implant / callers with max-h-*) own their height —
  // do not force a second inline maxHeight that fights Tailwind/CSS.
  const fluidShell =
    columnLayout ||
    classStr.includes('implant-wizard-dialog') ||
    classStr.includes('dialog-shell-fluid') ||
    /(?:^|\s)max-h-\[/.test(classStr) ||
    (style && style.maxHeight != null);

  return (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      data-dialog-shell={fluidShell ? 'notebook-fluid-v1' : 'default'}
      className={cn(
        "fixed z-[100] w-full max-w-lg border border-slate-100 bg-white p-6 shadow-2xl shadow-slate-200/50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 sm:rounded-[2.5rem] overflow-hidden",
        columnLayout
          ? "left-[50%] top-[50%] flex flex-col gap-0 overflow-hidden p-0"
          : "left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] grid gap-4 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
        className
      )}
      style={{
        // Default: leave ~1.25rem chrome; notebooks need more body than the old 2rem tax.
        ...(fluidShell
          ? null
          : {
              maxHeight:
                'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 1.25rem)',
            }),
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        ...(columnLayout ? {
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          paddingBottom: 0,
          minHeight: 0,
        } : null),
        ...style,
      }}
      {...props}>
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
  );
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
    {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props} />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props} />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
