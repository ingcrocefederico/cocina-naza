import * as React from "react"
import { useState } from "react"
import { Check, ChevronDown, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./sheet"
import { Input } from "./input"

export interface SelectSheetOption {
  value: string
  label: string
  sublabel?: string
}

export interface SelectSheetProps {
  value: string
  onValueChange: (value: string) => void
  options: SelectSheetOption[]
  placeholder?: string
  title?: string
  searchable?: boolean
  onCreate?: () => void
  createLabel?: string
  disabled?: boolean
  className?: string
  renderOption?: (option: SelectSheetOption, selected: boolean) => React.ReactNode
  renderValue?: (option: SelectSheetOption | undefined) => React.ReactNode
}

export function SelectSheet({
  value,
  onValueChange,
  options,
  placeholder = "Seleccioná...",
  title,
  searchable = false,
  onCreate,
  createLabel = "Nuevo...",
  disabled = false,
  className,
  renderOption,
  renderValue,
}: SelectSheetProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const selected = options.find(o => o.value === value)

  const filtered =
    searchable && search
      ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
      : options

  function handleSelect(val: string) {
    onValueChange(val)
    setOpen(false)
    setSearch("")
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setSearch("")
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {renderValue ? renderValue(selected) : (selected?.label ?? placeholder)}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
      </button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="bottom" className="flex flex-col gap-0 p-0 max-h-[80vh] rounded-t-2xl">
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-muted-foreground/25 shrink-0" />

          {(title || searchable) && (
            <SheetHeader className="px-5 pt-3 pb-2 shrink-0">
              {title && <SheetTitle className="text-base">{title}</SheetTitle>}
              {searchable && (
                <Input
                  placeholder="Buscar..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className={title ? "mt-2" : ""}
                />
              )}
            </SheetHeader>
          )}

          <div className="flex-1 overflow-y-auto">
            {filtered.map(option => {
              const isSelected = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 px-5 py-3.5 text-sm transition-colors text-left",
                    isSelected ? "bg-muted/50" : "active:bg-muted/40"
                  )}
                  onClick={() => handleSelect(option.value)}
                >
                  <span className="w-4 shrink-0 flex items-center justify-center">
                    {isSelected && <Check className="h-4 w-4 text-primary" />}
                  </span>
                  <span className="flex-1">
                    {renderOption ? renderOption(option, isSelected) : option.label}
                  </span>
                  {option.sublabel && (
                    <span className="text-xs text-muted-foreground">{option.sublabel}</span>
                  )}
                </button>
              )
            })}

            {filtered.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">Sin resultados.</p>
            )}

            {onCreate && (
              <button
                type="button"
                className="flex w-full items-center gap-3 px-5 py-4 text-sm text-primary active:bg-muted/40 border-t border-border"
                onClick={() => { handleOpenChange(false); onCreate() }}
              >
                <span className="w-4 shrink-0 flex items-center justify-center">
                  <Plus className="h-4 w-4" />
                </span>
                {createLabel}
              </button>
            )}

            <div className="h-6 shrink-0" />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
