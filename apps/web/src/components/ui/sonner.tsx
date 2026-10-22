"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

/**
 * Toasts sit top-right, just under the top bar (64px tall), and are larger than the default.
 * Each type has its own solid color (a tint of the status color) so a toast never blends into the page.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      offset={{ top: 80, right: 24 }}
      mobileOffset={{ top: 76, right: 12, left: 12 }}
      icons={{
        success: <CircleCheckIcon className="size-4 text-success" />,
        info: <InfoIcon className="size-4 text-sky-700 dark:text-sky-400" />,
        warning: <TriangleAlertIcon className="size-4 text-warning" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: <Loader2Icon className="size-4 animate-spin text-primary" />,
      }}
      style={
        {
          "--width": "min(340px, calc(100vw - 24px))",
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-lg)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "cn-toast !gap-2 !border !px-3.5 !py-2.5 !text-[13px] !leading-snug !font-medium !shadow-xl !shadow-black/25",
          title: "!text-[13px] !font-semibold",
          description: "!text-xs !opacity-90",
          // plain toast("...") = brand color
          default: "!border-primary/60 !bg-[color-mix(in_oklch,var(--primary-soft),var(--primary)_22%)] !text-foreground",
          success: "!border-success/60 !bg-[color-mix(in_oklch,var(--success-soft),var(--success)_22%)] !text-foreground",
          error: "!border-destructive/60 !bg-[color-mix(in_oklch,var(--destructive-soft),var(--destructive)_22%)] !text-foreground",
          warning: "!border-warning/60 !bg-[color-mix(in_oklch,var(--warning-soft),var(--warning)_22%)] !text-foreground",
          info: "!border-sky-500/60 !bg-sky-100 dark:!border-sky-400/60 dark:!bg-[#0f2f42] !text-foreground",
          loading: "!border-primary/60 !bg-[color-mix(in_oklch,var(--primary-soft),var(--primary)_22%)] !text-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
