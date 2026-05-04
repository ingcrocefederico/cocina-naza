import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useOrders, useUpdateOrder, useDeleteOrder, useCalculator, useOrderCounts, useLatestOrderDate } from '../hooks/useOrders'
import StatusBadge from '../components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Card, CardContent } from '@/components/ui/card'
import { SelectSheet } from '@/components/ui/select-sheet'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Plus, Trash2, Pencil, MapPin, FlaskConical, ChevronDown, Search, Users, Download, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { generatePedidosPDF } from '../lib/generatePedidosPDF'
import type { Order, OrderStatus } from '../types'

const STATUSES: OrderStatus[] = ['pedido', 'preparado', 'entregado', 'cobrado_efectivo', 'cobrado_transf']

const STATUS_BORDER: Record<OrderStatus, string> = {
  pedido:            'border-l-stone-500',
  preparado:         'border-l-amber-400',
  entregado:         'border-l-sky-400',
  cobrado:           'border-l-emerald-500',
  cobrado_efectivo:  'border-l-emerald-500',
  cobrado_transf:    'border-l-teal-500',
}

type SheetView = 'total' | 'por-sabor'

export default function Pedidos() {
  const [params, setParams] = useSearchParams()
  const today = format(new Date(), 'yyyy-MM-dd')
  const { data: latestDateData } = useLatestOrderDate()
  const latestDate = latestDateData?.date ?? today
  const date = params.get('date') || latestDate
  const [visibleMonth, setVisibleMonth] = useState(() => format(new Date(), 'yyyy-MM'))

  useEffect(() => {
    if (!params.get('date') && latestDateData?.date) {
      setVisibleMonth(latestDateData.date.substring(0, 7))
    }
  }, [latestDateData?.date])
  const { data: orderCounts = {} } = useOrderCounts(visibleMonth)

  const { data: orders = [], isLoading } = useOrders(date)
  const updateOrder = useUpdateOrder()
  const deleteOrder = useDeleteOrder()
  const navigate = useNavigate()


  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'deuda' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null)

  const [statusEditOrder, setStatusEditOrder] = useState<Order | null>(null)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetView, setSheetView] = useState<SheetView>('total')
  const [openFlavors, setOpenFlavors] = useState<Set<string>>(new Set())

  function toggleFlavor(id: string) {
    setOpenFlavors(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const { data: calc, isLoading: calcLoading } = useCalculator(date)

  function setDate(d: string) {
    setParams({ date: d })
    setSearch('')
    setStatusFilter(null)
  }

  function addPending(id: string) {
    setPendingIds(prev => new Set(prev).add(id))
  }
  function removePending(id: string) {
    setPendingIds(prev => { const next = new Set(prev); next.delete(id); return next })
  }

  function changeStatus(order: Order, status: OrderStatus) {
    addPending(order.id)
    updateOrder.mutate({ id: order.id, status }, { onSettled: () => removePending(order.id) })
  }

  function changeAllStatuses(status: OrderStatus) {
    orders.forEach(o => {
      addPending(o.id)
      updateOrder.mutate({ id: o.id, status }, { onSettled: () => removePending(o.id) })
    })
  }

  const COBRADO_STATUSES = ['cobrado', 'cobrado_efectivo', 'cobrado_transf'] as const

  const filteredOrders = orders.filter(o => {
    if (statusFilter === 'deuda' && COBRADO_STATUSES.includes(o.status as typeof COBRADO_STATUSES[number])) return false
    if (statusFilter && statusFilter !== 'deuda' && o.status !== statusFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return o.client_name.toLowerCase().includes(q) ||
        o.items.some(i => i.flavor_name.toLowerCase().includes(q))
    }
    return true
  })

  const totalBudines = orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0)
  const totalVenta = orders.reduce((sum, o) => sum + parseFloat(o.sale_price || '0'), 0)
  const deuda = orders.filter(o => !COBRADO_STATUSES.includes(o.status as typeof COBRADO_STATUSES[number])).reduce((sum, o) => sum + parseFloat(o.sale_price || '0'), 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="grid grid-cols-2 gap-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-foreground">Pedidos</h1>
          <DatePicker
            value={date}
            onChange={setDate}
            counts={orderCounts}
            onMonthChange={setVisibleMonth}
            className="w-40"
          />
        </div>
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/clientes')}
          >
            <Users className="w-4 h-4 mr-1" /> Clientes
          </Button>
        </div>
        <div className="flex items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSheetOpen(true)}
            disabled={orders.length === 0}
          >
            <FlaskConical className="w-4 h-4 mr-1" /> Ingredientes
          </Button>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => navigate(`/pedidos/nuevo?date=${date}`)} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Nuevo pedido
          </Button>
        </div>
      </div>

      {/* Totalizadores */}
      {orders.length > 0 && (
        <div className="flex flex-wrap gap-6 text-sm text-muted-foreground border-b border-border pb-3">
          <span><strong className="text-foreground">{orders.length}</strong> pedidos</span>
          <span><strong className="text-foreground">{totalBudines}</strong> budines</span>
          <span>Venta: <strong className="text-primary">${totalVenta.toLocaleString('es-AR')}</strong></span>
          {calc?.financials && (
            <>
              <span>Costo: <strong className="text-foreground">${calc.financials.totalCost.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</strong></span>
              <span>Gan.: <strong className={calc.financials.profit >= 0 ? 'text-green-500' : 'text-destructive'}>
                ${calc.financials.profit.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </strong></span>
            </>
          )}
          <span>Deuda: <strong className={deuda > 0 ? 'text-destructive' : 'text-foreground'}>${deuda.toLocaleString('es-AR')}</strong></span>
        </div>
      )}

      {orders.length > 0 && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar cliente o sabor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            {([null, 'deuda', 'pedido', 'preparado', 'entregado', 'cobrado_efectivo', 'cobrado_transf'] as const).map(s => {
              const active = statusFilter === s
              const labels: Record<string, string> = {
                deuda: 'Deuda', pedido: 'Pedido', preparado: 'Preparado',
                entregado: 'Entregado', cobrado_efectivo: 'Cob. Efectivo', cobrado_transf: 'Cob. Transf.',
              }
              const activeStyles: Record<string, string> = {
                deuda:            'bg-destructive/20 text-destructive border-destructive/40',
                pedido:           'bg-stone-700/50 text-stone-300 border-stone-600/40',
                preparado:        'bg-amber-900/50 text-amber-300 border-amber-700/40',
                entregado:        'bg-sky-900/50 text-sky-300 border-sky-700/40',
                cobrado_efectivo: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/40',
                cobrado_transf:   'bg-teal-900/50 text-teal-300 border-teal-700/40',
              }
              return (
                <button
                  key={String(s)}
                  type="button"
                  onClick={() => setStatusFilter(active ? null : s)}
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border cursor-pointer transition-colors ${
                    s === null
                      ? active || statusFilter === null
                        ? 'bg-primary/20 text-primary border-primary/40'
                        : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                      : active
                        ? activeStyles[s]
                        : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                  }`}
                >
                  {s === null ? 'Todos' : labels[s]}
                </button>
              )
            })}
            <div className="h-4 w-px bg-border mx-0.5" />
            <SelectSheet
              value=""
              onValueChange={val => changeAllStatuses(val as OrderStatus)}
              options={STATUSES.map(s => ({ value: s, label: s }))}
              renderOption={opt => <StatusBadge status={opt.value as OrderStatus} />}
              renderValue={() => <span className="text-muted-foreground">Cambiar todos</span>}
              title="Cambiar estado de todos los pedidos"
              className="h-6 text-xs border border-dashed border-border/70 px-2 shadow-none bg-transparent w-fit"
            />
          </div>
        </div>
      )}

      {isLoading && <div className="text-muted-foreground">Cargando...</div>}

      {!isLoading && orders.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">Sin pedidos para esta fecha.</div>
      )}

      {!isLoading && orders.length > 0 && filteredOrders.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          {search.trim() ? `Sin resultados para "${search}".` : 'Sin resultados.'}
        </div>
      )}

      {/* Lista de pedidos */}
      <div className="space-y-2">
        {filteredOrders.map(order => {
          const isPending = pendingIds.has(order.id)
          return (
            <Card
              key={order.id}
              className={cn(
                `border-l-[3px] ${STATUS_BORDER[order.status]} transition-all duration-200`,
                isPending && 'opacity-50 animate-pulse pointer-events-none'
              )}
            >
              <CardContent className="px-3 py-2.5 flex gap-2">
                {/* Izquierda: nombre + sabores + dirección/notas */}
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-foreground text-sm truncate block">{order.client_name}</span>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {order.items.map((item, idx) => (
                      <span key={idx} className="text-xs text-muted-foreground whitespace-nowrap">
                        {item.flavor_emoji} {item.flavor_name} <span className="font-medium text-foreground">×{item.quantity}</span>
                      </span>
                    ))}
                  </div>
                  {(order.address || order.notes) && (
                    <div className="flex items-center gap-2 mt-0.5">
                      {order.address && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5 truncate">
                          <MapPin className="w-3 h-3 shrink-0" />{order.address}
                        </span>
                      )}
                      {order.notes && (
                        <span className="text-xs text-muted-foreground italic truncate">{order.notes}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Derecha: arriba select+monto, abajo edit+remove */}
                <div className="flex flex-col items-end justify-between gap-1 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setStatusEditOrder(order)}
                      className="flex h-7 w-fit items-center gap-1 rounded-md px-2 text-xs bg-transparent hover:bg-muted/50 transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                      <StatusBadge status={order.status} />
                      <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
                    </button>
                    {order.sale_price && (
                      <span className="text-sm font-semibold text-primary tabular-nums">
                        ${parseFloat(order.sale_price).toLocaleString('es-AR')}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 cursor-pointer" disabled={isPending} onClick={() => navigate(`/pedidos/${order.id}?date=${date}`)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 cursor-pointer" disabled={isPending} onClick={() => setDeleteTarget(order)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Sheet de ingredientes */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="px-5 pt-5 pb-4 border-b border-border">
            <SheetTitle className="text-base">Ingredientes — {date}</SheetTitle>

            {/* Financials */}
            {calc && (
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="rounded-lg bg-muted p-2 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Costo</p>
                  <p className="text-sm font-semibold text-foreground">${calc.financials.totalCost.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</p>
                </div>
                <div className="rounded-lg bg-muted p-2 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Venta</p>
                  <p className="text-sm font-semibold text-primary">${calc.financials.totalSales.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</p>
                </div>
                <div className="rounded-lg bg-muted p-2 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ganancia</p>
                  <p className={`text-sm font-semibold ${calc.financials.profit >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                    ${calc.financials.profit.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            )}

            {/* Toggle */}
            <div className="flex gap-1 pt-3 bg-muted rounded-lg p-1">
              <Button
                variant={sheetView === 'total' ? 'default' : 'ghost'}
                size="sm"
                className="flex-1 h-8"
                onClick={() => setSheetView('total')}
              >
                Total
              </Button>
              <Button
                variant={sheetView === 'por-sabor' ? 'default' : 'ghost'}
                size="sm"
                className="flex-1 h-8"
                onClick={() => setSheetView('por-sabor')}
              >
                Por sabor
              </Button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
            {calcLoading && <p className="text-sm text-muted-foreground">Cargando...</p>}

            {/* Vista Total */}
            {!calcLoading && calc && sheetView === 'total' && (
              <>
                <div className="flex justify-end pb-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8"
                    onClick={() => generatePedidosPDF(date, orders, calc)}
                  >
                    <Download className="w-3.5 h-3.5" /> Descargar PDF
                  </Button>
                </div>
                {calc.totals.length === 0
                  ? <p className="text-sm text-muted-foreground text-center py-8">Sin datos de recetas para esta fecha.</p>
                  : calc.totals.map(ing => (
                  <div key={ing.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="text-sm text-foreground font-medium">{ing.name}</span>
                    <div className="text-right">
                      <span className="text-sm tabular-nums text-foreground">
                        {ing.totalQuantity % 1 === 0 ? ing.totalQuantity : ing.totalQuantity.toFixed(2)} {ing.unit}
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        ${ing.totalCost.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Vista Por sabor */}
            {!calcLoading && calc && sheetView === 'por-sabor' && (
              calc.byFlavor.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-8">Sin datos de recetas para esta fecha.</p>
                : calc.byFlavor.map(flavor => {
                  const isOpen = openFlavors.has(flavor.flavorId)
                  return (
                    <div key={flavor.flavorId} className="rounded-lg border border-border overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleFlavor(flavor.flavorId)}
                        className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/50 hover:bg-muted/80 transition-colors text-left"
                      >
                        <span className="text-sm font-semibold text-foreground">{flavor.flavorName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{flavor.budinCount} budín{flavor.budinCount !== 1 ? 'es' : ''}</span>
                          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                      {isOpen && (
                        <div className="divide-y divide-border">
                          {flavor.ingredients.map(ing => (
                            <div key={ing.id} className="flex items-center justify-between px-3 py-1.5">
                              <span className="text-sm text-muted-foreground">{ing.name}</span>
                              <span className="text-sm tabular-nums text-foreground">
                                {ing.totalQuantity % 1 === 0 ? ing.totalQuantity : ing.totalQuantity.toFixed(2)} {ing.unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet de cambio de estado individual */}
      <Sheet open={!!statusEditOrder} onOpenChange={open => !open && setStatusEditOrder(null)}>
        <SheetContent side="bottom" className="flex flex-col gap-0 p-0 max-h-[80vh] rounded-t-2xl">
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-muted-foreground/25 shrink-0" />
          <SheetHeader className="px-5 pt-3 pb-2 shrink-0">
            <SheetTitle className="text-base">Estado del pedido</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            {STATUSES.map(s => {
              const isSelected = statusEditOrder?.status === s
              return (
                <button
                  key={s}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 px-5 py-3.5 text-sm transition-colors text-left',
                    isSelected ? 'bg-muted/50' : 'active:bg-muted/40'
                  )}
                  onClick={() => {
                    if (statusEditOrder) changeStatus(statusEditOrder, s)
                    setStatusEditOrder(null)
                  }}
                >
                  <span className="w-4 shrink-0 flex items-center justify-center">
                    {isSelected && <Check className="h-4 w-4 text-primary" />}
                  </span>
                  <span className="flex-1">
                    <StatusBadge status={s} />
                  </span>
                </button>
              )
            })}
            <div className="h-6 shrink-0" />
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el pedido de <strong>{deleteTarget?.client_name}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { deleteOrder.mutate(deleteTarget!.id); setDeleteTarget(null) }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


    </div>
  )
}
