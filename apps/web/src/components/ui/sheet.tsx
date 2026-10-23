"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"

/**
 * Slide-over panel built on the same Base UI dialog as ui/dialog.tsx (focus trap, Escape, outside click, scroll lock).
 * It docks to the right edge; below `sm` it fills the screen.
 */
function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetContent({
  className,
  children,
  ...props
}: SheetPrimitive.Popup.Props) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Backdrop
        data-slot="sheet-overlay"
        className="fixed inset-0 isolate z-50 bg-black/40 duration-200 supports-backdrop-filter:backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col border-l border-border bg-popover text-sm text-popover-foreground shadow-2xl shadow-black/30 outline-none duration-200 sm:max-w-[440px] data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right",
          className
        )}
        {...props}
      >
        {children}
      </SheetPrimitive.Popup>
    </SheetPrimitive.Portal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1", className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-base leading-none font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
}
