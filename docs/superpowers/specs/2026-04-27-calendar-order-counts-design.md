# Calendar Order Counts — Design Spec

**Date:** 2026-04-27

## Goal

Show a count of orders per day directly in the DatePicker calendar, so the user can see at a glance which days have pedidos and how many.

## Visual Style

Option B: small orange number below the day number. No indicator shown for days with zero orders.

Example: day 26 with 3 orders shows "26" with a small "3" in orange below it.

## Architecture

### 1. Backend — New endpoint

`GET /api/orders/counts?month=YYYY-MM`

- Query: `SELECT date, COUNT(*) as count FROM orders WHERE date_trunc('month', date) = $1 GROUP BY date`
- Response: `Record<string, number>` — only dates with at least 1 order, e.g. `{ "2026-04-26": 3, "2026-04-27": 1 }`
- Returns empty object `{}` if no orders that month.

### 2. Frontend — Hook

`useOrderCounts(month: string)` in `frontend/src/hooks/useOrders.ts`

- Query key: `['order-counts', month]`
- Fetches `GET /api/orders/counts?month=<month>`
- `month` format: `"YYYY-MM"` (derived from the calendar's visible month)
- Enabled when `!!month`

### 3. Frontend — DatePicker changes

`frontend/src/components/ui/date-picker.tsx`

- Add prop: `counts?: Record<string, number>`
- Pass counts down to `<Calendar>` via its `components` prop (react-day-picker custom day renderer)
- Custom `DayContent` renders: day number + orange count below if `counts[formattedDate] > 0`

### 4. Frontend — Pedidos.tsx

- Track the visible calendar month in local state (defaults to current month)
- Call `useOrderCounts(visibleMonth)` 
- Pass `counts` to `<DatePicker>`
- When calendar month changes (prev/next arrows), update `visibleMonth`

### 5. Cache invalidation

In `useOrders.ts`, wherever `orders` mutations invalidate `['orders', date]`, also invalidate `['order-counts', month]` (derived from the date).

## Data Flow

```
User opens DatePicker
  → Pedidos.tsx tracks visibleMonth (e.g. "2026-04")
  → useOrderCounts("2026-04") fetches /api/orders/counts?month=2026-04
  → Calendar renders each day with count if > 0

User navigates to next month
  → visibleMonth updates to "2026-05"
  → useOrderCounts("2026-05") fetches new month

User creates/edits/deletes a pedido
  → mutations invalidate ['order-counts', month]
  → calendar refetches and updates counts
```

## Out of Scope

- Showing order counts in months the user hasn't navigated to (lazy fetch per month is fine)
- Tooltip or hover state on days with counts
- Distinguishing order statuses in the count (all statuses counted equally)
