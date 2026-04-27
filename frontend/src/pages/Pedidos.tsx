import { useState } from 'react'
import { format } from 'date-fns'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useOrders, useUpdateOrder, useDeleteOrder, useCalculator, useOrderCounts } from '../hooks/useOrders'
import StatusBadge from '../components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Card, CardContent } from '@/components/ui/card'
import { SelectSheet } from '@/components/ui/select-sheet'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Plus, Trash2, Pencil, MapPin, FlaskConical, ChevronDown } from 'lucide-react'
import type { Order, OrderStatus } from '../types'

const STATUSES: OrderStatus[] = ['pedido', 'preparado', 'entregado', 'cobrado']

const STATUS_BORDER: Record<OrderStatus, string> = {
  pedido:    'border-l-stone-500',
  preparado: 'border-l-amber-400',
  entregado: 'border-l-sky-400',
  cobrado:   'border-l-emerald-500',
}

type SheetView = 'total' | 'por-sabor'

export default function Pedidos() {
  const [params, setParams] = useSearchParams()
  const today = format(new Date(), 'yyyy-MM-dd')
  const date = params.get('date') || today
  const [visibleMonth, setVisibleMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const { data: orderCounts = {} } = useOrderCounts(visibleMonth)

  const { data: orders = [], isLoading } = useOrders(date)
  const updateOrder = useUpdateOrder()
  const deleteOrder = useDeleteOrder()
  const navigate = useNavigate()


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
  }

  function changeStatus(order: Order, status: OrderStatus) {
    updateOrder.mutate({ id: order.id, status })
  }

  const totalBudines = orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0)
  const totalVenta = orders.reduce((sum, o) => sum + parseFloat(o.sale_price || '0'), 0)
  const deuda = orders.filter(o => o.status !== 'cobrado').reduce((sum, o) => sum + parseFloat(o.sale_price || '0'), 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSheetOpen(true)}
            disabled={orders.length === 0}
          >
            <FlaskConical className="w-4 h-4 mr-1" /> Ingredientes
          </Button>
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

      {isLoading && <div className="text-muted-foreground">Cargando...</div>}

      {!isLoading && orders.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">Sin pedidos para esta fecha.</div>
      )}

      {/* Lista de pedidos */}
      <div className="space-y-2">
        {orders.map(order => (
          <Card
            key={order.id}
            className={`border-l-[3px] ${STATUS_BORDER[order.status]} transition-colors`}
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
                  <SelectSheet
                    value={order.status}
                    onValueChange={val => changeStatus(order, val as OrderStatus)}
                    options={STATUSES.map(s => ({ value: s, label: s }))}
                    renderValue={opt => opt ? <StatusBadge status={opt.value as OrderStatus} /> : <StatusBadge status={order.status} />}
                    renderOption={opt => <StatusBadge status={opt.value as OrderStatus} />}
                    title="Estado del pedido"
                    className="w-fit h-7 text-xs px-2 border-0 shadow-none bg-transparent"
                  />
                  {order.sale_price && (
                    <span className="text-sm font-semibold text-primary tabular-nums">
                      ${parseFloat(order.sale_price).toLocaleString('es-AR')}
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 cursor-pointer" onClick={() => navigate(`/pedidos/${order.id}?date=${date}`)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 cursor-pointer" onClick={() => deleteOrder.mutate(order.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
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
              calc.totals.length === 0
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
                ))
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
    </div>
  )
}
