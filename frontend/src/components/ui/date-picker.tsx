import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { es } from "react-day-picker/locale"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DatePickerProps {
  value?: string
  onChange?: (value: string) => void
  className?: string
}

export function DatePicker({ value, onChange, className }: DatePickerProps) {
  const parsed = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined
  const date = parsed && isValid(parsed) ? parsed : undefined

  function handleSelect(selected: Date | undefined) {
    if (selected) onChange?.(format(selected, "yyyy-MM-dd"))
  }

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
          locale={es}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
