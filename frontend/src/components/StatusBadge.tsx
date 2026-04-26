import type { OrderStatus } from '../types'

const config: Record<OrderStatus, { label: string; className: string }> = {
  pedido:    { label: 'Pedido',    className: 'bg-slate-100 text-slate-700' },
  preparado: { label: 'Preparado', className: 'bg-yellow-100 text-yellow-800' },
  entregado: { label: 'Entregado', className: 'bg-blue-100 text-blue-800' },
  cobrado:   { label: 'Cobrado',   className: 'bg-green-100 text-green-800' },
}

export default function StatusBadge({ status }: { status: OrderStatus }) {
  const { label, className } = config[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
