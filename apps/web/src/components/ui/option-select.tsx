"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { cn } from "cn"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

export type SelectOption = {
  value: string
  label: string
  /** Optional accent colour (any CSS colour). Shows a dot and tints the pill variant. */
  color?: string
  description?: string
}

type OptionSelectProps = {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  required?: boolean
  "aria-label"?: string
  /** "field" = full-width form control, "pill" = compact coloured status chip. */
  variant?: "field" | "pill"
  className?: string
  /** Min width of the open menu. Defaults to the trigger width (at least 11rem). */
  menuClassName?: string
}

const mix = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`

/**
 * Themed dropdown built on Base UI Select: rounded trigger, floating rounded menu,
 * colour dots and a check on the active option — replaces the native <select>.
 */
export function OptionSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  disabled,
  required,
  variant = "field",
  className,
  menuClassName,
  ...rest
}: OptionSelectProps) {
  const selected = options.find((o) => o.value === value)
  const pill = variant === "pill"
  const tint = pill && selected?.color
  const pillStyle: React.CSSProperties | undefined = tint
    ? {
        color: `color-mix(in srgb, ${selected!.color} 62%, var(--foreground))`,
        backgroundColor: mix(selected!.color!, 13),
        borderColor: mix(selected!.color!, 32),
      }
    : undefined

  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={(next) => next != null && onValueChange(String(next))}
      disabled={disabled}
      required={required}
    >
      <SelectPrimitive.Trigger
        aria-label={rest["aria-label"]}
        style={pillStyle}
        className={cn(
          "group/trigger inline-flex items-center justify-between gap-2 border text-left outline-none transition-all select-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60",
          pill
            ? "h-8 min-w-32 rounded-lg px-2.5 text-xs font-semibold hover:brightness-110"
            : "h-9 w-full rounded-lg border-input bg-background px-3 text-sm hover:border-primary/40 focus-visible:border-ring data-[popup-open]:border-ring dark:bg-input/30",
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.color && (
            <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: selected.color }} aria-hidden />
          )}
          <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected?.label ?? placeholder}</span>
        </span>
        <ChevronDownIcon
          className={cn(
            "pointer-events-none shrink-0 opacity-70 transition-transform duration-200 group-data-[popup-open]/trigger:rotate-180",
            pill ? "size-3.5" : "size-4 text-muted-foreground",
          )}
        />
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner side="bottom" align="start" sideOffset={4} alignItemWithTrigger={false} className="isolate z-50">
          <SelectPrimitive.Popup
            className={cn(
              "max-h-(--available-height) min-w-(--anchor-width) origin-(--transform-origin) overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg shadow-black/20 outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=bottom]:slide-in-from-top-1",
              pill ? "w-(--anchor-width) min-w-0" : "",
              menuClassName,
            )}
          >
            <SelectPrimitive.List className="flex flex-col">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  className="relative flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-7 pl-2 text-xs outline-none select-none transition-colors data-[highlighted]:bg-muted data-[selected]:font-medium data-disabled:pointer-events-none data-disabled:opacity-50"
                >
                  {option.color && (
                    <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: option.color }} aria-hidden />
                  )}
                  <SelectPrimitive.ItemText className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{option.label}</span>
                    {option.description && <span className="truncate text-xs font-normal text-muted-foreground">{option.description}</span>}
                  </SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="absolute right-2 flex size-3.5 items-center justify-center text-primary">
                    <CheckIcon className="size-3.5" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
