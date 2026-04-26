import { format } from 'date-fns'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useOrders, useUpdateOrder, useDeleteOrder } from '../hooks/useOrders'
import StatusBadge from '../components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Pencil, MapPin } from 'lucide-react'
import type { Order, OrderStatus } from '../types'

const STATUSES: OrderStatus[] = ['pedido', 'preparado', 'entregado', 'cobrado']

export default function Pedidos() {
  const [params, setParams] = useSearchParams()
  const today = format(new Date(), 'yyyy-MM-dd')
  const date = params.get('date') || today

  const { data: orders = [], isLoading } = useOrders(date)
  const updateOrder = useUpdateOrder()
  const deleteOrder = useDeleteOrder()
  const navigate = useNavigate()

  function setDate(d: string) {
    setParams({ date: d })
  }

  function changeStatus(order: Order, status: OrderStatus) {
    updateOrder.mutate({ id: order.id, status })
  }

  const totalBudines = orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0)
  const totalVenta = orders.reduce((sum, o) => sum + parseFloat(o.sale_price || '0'), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-slate-800">Pedidos</h1>
          <Input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-40"
          />
        </div>
        <Button onClick={() => navigate(`/pedidos/nuevo?date=${date}`)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Nuevo pedido
        </Button>
      </div>

      {isLoading && <div className="text-slate-500">Cargando...</div>}

      {!isLoading && orders.length === 0 && (
        <div className="text-center py-16 text-slate-400">Sin pedidos para esta fecha.</div>
      )}

      <div className="space-y-3">
        {orders.map(order => (
          <Card key={order.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800">{order.client_name}</span>
                    <Select
                      value={order.status}
                      onValueChange={val => changeStatus(order, val as OrderStatus)}
                    >
                      <SelectTrigger className="w-fit h-7 px-2 border-0 shadow-none bg-transparent focus:ring-0">
                        <SelectValue>
                          <StatusBadge status={order.status} />
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map(s => (
                          <SelectItem key={s} value={s}>
                            <StatusBadge status={s} />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {order.address && (
                    <div className="flex items-center gap-1 text-sm text-slate-500">
                      <MapPin className="w-3.5 h-3.5" /> {order.address}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {order.items.map((item, idx) => (
                      <span key={idx} className="text-sm bg-slate-100 rounded px-2 py-0.5">
                        {item.flavor_emoji} {item.flavor_name} ×{item.quantity}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {order.sale_price && (
                    <span className="text-sm font-medium text-slate-700 mr-2">
                      ${parseFloat(order.sale_price).toLocaleString('es-AR')}
                    </span>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/pedidos/${order.id}?date=${date}`)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteOrder.mutate(order.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {orders.length > 0 && (
        <div className="border-t pt-3 flex gap-6 text-sm text-slate-600">
          <span><strong>{orders.length}</strong> pedidos</span>
          <span><strong>{totalBudines}</strong> budines</span>
          <span>Total venta: <strong>${totalVenta.toLocaleString('es-AR')}</strong></span>
        </div>
      )}
    </div>
  )
}
