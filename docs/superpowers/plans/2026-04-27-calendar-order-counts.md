# Calendar Order Counts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the number of orders per day directly in the DatePicker calendar as a small orange number below the day.

**Architecture:** A new lightweight backend endpoint returns per-day counts for a given month. A new `useOrderCounts` hook fetches this via react-query. The DatePicker renders a custom `DayButton` that overlays the count below the day number.

**Tech Stack:** Express/PostgreSQL (backend), React + react-day-picker v9 + TanStack Query (frontend), Vitest/supertest (tests)

---

## File Map

| File | Change |
|------|--------|
| `backend/src/routes/orders.ts` | Add `GET /counts` route |
| `backend/src/routes/orders.test.ts` | Add tests for `GET /counts` |
| `frontend/src/hooks/useOrders.ts` | Add `useOrderCounts` hook; broaden mutation invalidation |
| `frontend/src/components/ui/calendar.tsx` | Merge external `components` prop with internal Chevron |
| `frontend/src/components/ui/date-picker.tsx` | Add `counts` + `onMonthChange` props; custom `DayButton` |
| `frontend/src/pages/Pedidos.tsx` | Track `visibleMonth`, call `useOrderCounts`, pass to DatePicker |

---

### Task 1: Backend — GET /api/orders/counts

**Files:**
- Modify: `backend/src/routes/orders.ts`
- Test: `backend/src/routes/orders.test.ts`

- [ ] **Step 1: Write the failing test**

Add a new describe block at the bottom of `backend/src/routes/orders.test.ts`:

```typescript
describe('GET /api/orders/counts', () => {
  beforeEach(() => mockQuery.mockReset())

  it('requires auth', async () => {
    const res = await request(makeApp()).get('/api/orders/counts?month=2026-04')
    expect(res.status).toBe(401)
  })

  it('requires month param', async () => {
    const res = await request(makeApp())
      .get('/api/orders/counts')
      .set('Cookie', authCookie())
    expect(res.status).toBe(400)
  })

  it('returns counts keyed by date', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { date: '2026-04-26', count: 3 },
        { date: '2026-04-27', count: 1 },
      ],
    })
    const res = await request(makeApp())
      .get('/api/orders/counts?month=2026-04')
      .set('Cookie', authCookie())
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ '2026-04-26': 3, '2026-04-27': 1 })
  })

  it('returns empty object when no orders', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] })
    const res = await request(makeApp())
      .get('/api/orders/counts?month=2026-04')
      .set('Cookie', authCookie())
    expect(res.status).toBe(200)
    expect(res.body).toEqual({})
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npm test -- --reporter=verbose 2>&1 | grep -A3 "GET /api/orders/counts"
```

Expected: 4 failures (route doesn't exist yet).

- [ ] **Step 3: Add the route**

In `backend/src/routes/orders.ts`, add this block **after** the existing `ordersRouter.get('/', ...)` handler (around line 48) and **before** the `ordersRouter.post`:

```typescript
ordersRouter.get('/counts', async (req, res) => {
  const { month } = req.query
  if (!month || !/^\d{4}-\d{2}$/.test(month as string)) {
    res.status(400).json({ error: 'month query param required (YYYY-MM)' })
    return
  }
  const result = await query<{ date: string; count: number }>(
    `SELECT TO_CHAR(date, 'YYYY-MM-DD') AS date, COUNT(*)::int AS count
     FROM orders
     WHERE TO_CHAR(date, 'YYYY-MM') = $1
     GROUP BY date`,
    [month as string]
  )
  const counts: Record<string, number> = {}
  for (const row of result.rows) {
    counts[row.date] = row.count
  }
  res.json(counts)
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npm test -- --reporter=verbose 2>&1 | grep -A3 "GET /api/orders/counts"
```

Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/orders.ts backend/src/routes/orders.test.ts
git commit -m "feat: GET /api/orders/counts — per-day order counts for a month"
```

---

### Task 2: Frontend — useOrderCounts hook + broaden invalidation

**Files:**
- Modify: `frontend/src/hooks/useOrders.ts`

- [ ] **Step 1: Add the hook and update mutations**

Replace the entire contents of `frontend/src/hooks/useOrders.ts` with:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type { Order, OrderStatus, CalculatorResult } from '../types'

export type OrderItemInput = { flavor_id: string; quantity: number }

export interface CreateOrderInput {
  client_name: string
  address?: string
  date?: string
  status?: OrderStatus
  sale_price?: string
  notes?: string
  items: OrderItemInput[]
}

export interface UpdateOrderInput {
  id: string
  client_name?: string
  address?: string
  date?: string
  status?: OrderStatus
  sale_price?: string
  notes?: string
  items?: OrderItemInput[]
}

export function useOrders(date: string) {
  return useQuery<Order[]>({
    queryKey: ['orders', date],
    queryFn: async () => (await api.get(`/api/orders?date=${date}`)).data,
    enabled: !!date,
  })
}

export function useOrderCounts(month: string) {
  return useQuery<Record<string, number>>({
    queryKey: ['order-counts', month],
    queryFn: async () => (await api.get(`/api/orders/counts?month=${month}`)).data,
    enabled: !!month,
  })
}

export function useCalculator(date: string) {
  return useQuery<CalculatorResult>({
    queryKey: ['calculator', date],
    queryFn: async () => (await api.get(`/api/ingredients/calculator?date=${date}`)).data,
    enabled: !!date,
  })
}

export function useCreateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateOrderInput) => api.post<Order>('/api/orders', data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['orders', vars.date] })
      qc.invalidateQueries({ queryKey: ['order-counts'] })
    },
  })
}

export function useUpdateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateOrderInput) =>
      api.put<Order>(`/api/orders/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['order-counts'] })
    },
  })
}

export function useDeleteOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/orders/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['order-counts'] })
    },
  })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useOrders.ts
git commit -m "feat: useOrderCounts hook + invalidate order-counts on mutations"
```

---

### Task 3: Frontend — Calendar merges external components prop

**Files:**
- Modify: `frontend/src/components/ui/calendar.tsx`

- [ ] **Step 1: Destructure and merge components**

Replace `frontend/src/components/ui/calendar.tsx` with:

```typescript
import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components: extraComponents,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month_caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "flex items-center gap-1",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "absolute left-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "absolute right-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        range_end: "day-range-end",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        today: "bg-accent text-accent-foreground",
        outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        disabled: "text-muted-foreground opacity-50",
        range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
        ...extraComponents,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/calendar.tsx
git commit -m "fix: calendar merges external components prop with internal Chevron"
```

---

### Task 4: Frontend — DatePicker renders order counts

**Files:**
- Modify: `frontend/src/components/ui/date-picker.tsx`

- [ ] **Step 1: Update DatePicker**

Replace `frontend/src/components/ui/date-picker.tsx` with:

```typescript
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
      const count = counts[dateStr] ?? 0
      return (
        <button
          {...buttonProps}
          className={cn(buttonProps.className, count > 0 && "flex-col h-auto py-0.5")}
        >
          <span className="block leading-none">{children}</span>
          {count > 0 && (
            <span className="block text-[9px] font-bold text-primary leading-none mt-0.5">
              {count}
            </span>
          )}
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors. If `DayButtonProps` is not exported from `react-day-picker`, use `import type { DayButtonProps } from "react-day-picker/types"` or inline the type as `React.ComponentProps<"button"> & { day: { date: Date }; modifiers: Record<string, boolean> }`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/date-picker.tsx
git commit -m "feat: DatePicker shows order count per day in calendar"
```

---

### Task 5: Frontend — Pedidos.tsx wires up counts

**Files:**
- Modify: `frontend/src/pages/Pedidos.tsx`

- [ ] **Step 1: Add visibleMonth state and useOrderCounts**

In `frontend/src/pages/Pedidos.tsx`, make these changes:

1. Add `useOrderCounts` to the import from `'../hooks/useOrders'`:

```typescript
import { useOrders, useUpdateOrder, useDeleteOrder, useCalculator, useOrderCounts } from '../hooks/useOrders'
```

2. After the existing `const date = params.get('date') || today` (line 29), add:

```typescript
const [visibleMonth, setVisibleMonth] = useState(() => format(new Date(), 'yyyy-MM'))
const { data: orderCounts = {} } = useOrderCounts(visibleMonth)
```

3. Update the `<DatePicker>` usage (line 68) to pass the new props:

```typescript
<DatePicker
  value={date}
  onChange={setDate}
  counts={orderCounts}
  onMonthChange={setVisibleMonth}
  className="w-40"
/>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Pedidos.tsx
git commit -m "feat: Pedidos shows per-day order counts in DatePicker calendar"
```

---

### Task 6: Manual verification

- [ ] **Step 1: Start backend and frontend**

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

- [ ] **Step 2: Verify endpoint directly**

```bash
curl -s "http://localhost:3000/api/orders/counts?month=2026-04" \
  -H "Cookie: token=<your-token>" | jq .
```

Expected: a JSON object like `{ "2026-04-26": 3 }` (or `{}` if no orders exist yet).

- [ ] **Step 3: Open the app and check the calendar**

1. Navigate to Pedidos.
2. Open the DatePicker.
3. Days with orders should show a small orange number below the date.
4. Navigate to a different month using the arrows — counts should update for that month.
5. Create a new order on a day with 0 orders — the calendar should refresh and show count `1` on that day.
