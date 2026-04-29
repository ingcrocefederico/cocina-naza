import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Order, CalculatorResult } from '../types'

const STATUS_LABEL: Record<string, string> = {
  pedido:           'Pedido',
  preparado:        'Preparado',
  entregado:        'Entregado',
  cobrado:          'Cobrado',
  cobrado_efectivo: 'Cob. Efectivo',
  cobrado_transf:   'Cob. Transf.',
}

export function generatePedidosPDF(
  date: string,
  orders: Order[],
  calc: CalculatorResult,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 14
  let y = margin

  const formattedDate = format(parseISO(date), "EEEE d 'de' MMMM yyyy", { locale: es })

  // ── Title ──────────────────────────────────────────────────────────
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Cocina — Pedidos', margin, y)
  y += 7

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)
  doc.text(formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1), margin, y)
  doc.setTextColor(0)
  y += 8

  // ── Financials ─────────────────────────────────────────────────────
  const totalBudines = orders.reduce((s, o) => s + o.items.reduce((si, i) => si + i.quantity, 0), 0)
  const cobradoStatuses = ['cobrado', 'cobrado_efectivo', 'cobrado_transf']
  const deuda = orders
    .filter(o => !cobradoStatuses.includes(o.status))
    .reduce((s, o) => s + parseFloat(o.sale_price || '0'), 0)

  autoTable(doc, {
    startY: y,
    head: [['Pedidos', 'Budines', 'Venta', 'Costo', 'Ganancia', 'Deuda']],
    body: [[
      orders.length,
      totalBudines,
      `$${calc.financials.totalSales.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`,
      `$${calc.financials.totalCost.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`,
      `$${calc.financials.profit.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`,
      `$${deuda.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`,
    ]],
    theme: 'grid',
    headStyles: { fillColor: [30, 30, 30], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 10, halign: 'center' },
    margin: { left: margin, right: margin },
  })
  y = (doc as any).lastAutoTable.finalY + 10

  // ── Orders table ───────────────────────────────────────────────────
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Pedidos del día', margin, y)
  y += 4

  autoTable(doc, {
    startY: y,
    head: [['Cliente', 'Sabores', 'Estado', 'Precio']],
    body: orders.map(o => [
      o.client_name,
      o.items.map(i => `${i.flavor_emoji} ${i.flavor_name} ×${i.quantity}`).join('\n'),
      STATUS_LABEL[o.status] ?? o.status,
      o.sale_price ? `$${parseFloat(o.sale_price).toLocaleString('es-AR')}` : '—',
    ]),
    theme: 'striped',
    headStyles: { fillColor: [30, 30, 30], textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 25, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  })
  y = (doc as any).lastAutoTable.finalY + 10

  // ── Ingredients table ──────────────────────────────────────────────
  if (calc.totals.length > 0) {
    // start new page if little space left
    if (y > 220) {
      doc.addPage()
      y = margin
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Ingredientes totales', margin, y)
    y += 4

    autoTable(doc, {
      startY: y,
      head: [['Ingrediente', 'Cantidad', 'Unidad', 'Costo']],
      body: calc.totals.map(ing => [
        ing.name,
        ing.totalQuantity % 1 === 0 ? ing.totalQuantity : ing.totalQuantity.toFixed(2),
        ing.unit,
        `$${ing.totalCost.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [30, 30, 30], textColor: 255, fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 30, halign: 'right' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
      },
      margin: { left: margin, right: margin },
    })
  }

  // ── Footer ─────────────────────────────────────────────────────────
  const pageCount = (doc.internal as any).pages.length - 1
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageW - margin,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'right' }
    )
    doc.setTextColor(0)
  }

  doc.save(`pedidos-${date}.pdf`)
}
