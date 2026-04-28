import type { OrderStatus } from '../types'

const config: Record<OrderStatus, { label: string; className: string }> = {
  pedido:            { label: 'Pedido',        className: 'bg-stone-700/50 text-stone-300 border border-stone-600/40' },
  preparado:         { label: 'Preparado',     className: 'bg-amber-900/50 text-amber-300 border border-amber-700/40' },
  entregado:         { label: 'Entregado',     className: 'bg-sky-900/50 text-sky-300 border border-sky-700/40' },
  cobrado:           { label: 'Cobrado',       className: 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/40' },
  cobrado_efectivo:  { label: 'Cob. Efectivo', className: 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/40' },
  cobrado_transf:    { label: 'Cob. Transf.',  className: 'bg-teal-900/50 text-teal-300 border border-teal-700/40' },
}

export default function StatusBadge({ status }: { status: OrderStatus }) {
  const { label, className } = config[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
