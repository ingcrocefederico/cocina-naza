import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { es } from "react-day-picker/locale"
import type { DayButtonProps } from "react-day-picker"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DatePickerProps {
  value?: string
  onChange?: (value: string) => void
  onMonthChange?: (month: string) => void
  counts?: Record<string, number>
  className?: string
}

export function DatePicker({ value, onChange, onMonthChange, counts = {}, className }: DatePickerProps) {
  const parsed = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined
  const date = parsed && isValid(parsed) ? parsed : undefined

  function handleSelect(selected: Date | undefined) {
    if (selected) onChange?.(format(selected, "yyyy-MM-dd"))
  }

  function handleMonthChange(month: Date) {
    onMonthChange?.(format(month, "yyyy-MM"))
  }

  const DayButton = React.useCallback(
    ({ day, modifiers, children, ...buttonProps }: DayButtonProps) => {
      const dateStr = format(day.date, "yyyy-MM-dd")
      const hasOrders = (counts[dateStr] ?? 0) > 0 && !modifiers.selected && !modifiers.today
      return (
        <button
          {...buttonProps}
          className={cn(buttonProps.className, hasOrders && "text-primary font-semibold")}
        >
          {children}
        </button>
      )
    },
    [counts]
  )

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {date
            ? format(date, "d 'de' MMMM, yyyy", { locale: es })
            : "Elegí una fecha"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          onMonthChange={handleMonthChange}
          locale={es}
          autoFocus
          components={{ DayButton }}
        />
      </PopoverContent>
    </Popover>
  )
}
