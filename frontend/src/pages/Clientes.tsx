import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2, Search, Phone, MapPin } from 'lucide-react'
import { useClients, useDeleteClient } from '../hooks/useClients'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import ClientSheet from '../components/ClientSheet'
import type { ClientWithStats } from '../types'

type EstadoFilter = 'todos' | 'deudor' | 'al_dia'

const FILTER_OPTIONS: { value: EstadoFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'deudor', label: 'Deudores' },
  { value: 'al_dia', label: 'Al día' },
]

const FILTER_ACTIVE_STYLES: Record<EstadoFilter, string> = {
  todos:   'bg-primary/20 text-primary border-primary/40',
  deudor:  'bg-destructive/20 text-destructive border-destructive/40',
  al_dia:  'bg-emerald-900/50 text-emerald-300 border-emerald-700/40',
}

export default function Clientes() {
  const navigate = useNavigate()
  const { data: clients = [], isLoading } = useClients()
  const deleteClient = useDeleteClient()

  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('todos')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<ClientWithStats | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ClientWithStats | null>(null)

  function openCreate() {
    setEditingClient(null)
    setSheetOpen(true)
  }

  function openEdit(client: ClientWithStats) {
    setEditingClient(client)
    setSheetOpen(true)
  }

  const filtered = clients.filter(c => {
    if (estadoFilter !== 'todos' && c.estado !== estadoFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return c.name.toLowerCase().includes(q) || (c.phone ?? '').toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Clientes</h1>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> Nuevo cliente
        </Button>
      </div>

      {/* Search + Filter chips */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por nombre o teléfono..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setEstadoFilter(opt.value)}
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border cursor-pointer transition-colors ${
                estadoFilter === opt.value
                  ? FILTER_ACTIVE_STYLES[opt.value]
                  : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <div className="text-muted-foreground">Cargando...</div>}

      {!isLoading && clients.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          Sin clientes. Creá el primero con el botón +
        </div>
      )}

      {!isLoading && clients.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">Sin resultados.</div>
      )}

      {/* Client list */}
      <div className="space-y-2">
        {filtered.map(client => (
          <Card key={client.id}>
            <CardContent className="px-3 py-2.5 flex gap-2">
              <div className="flex-1 min-w-0">
                {/* Name + estado + debt */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-foreground">{client.name}</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    client.estado === 'deudor'
                      ? 'bg-destructive/15 text-destructive'
                      : 'bg-emerald-900/30 text-emerald-400'
                  }`}>
                    {client.estado === 'deudor' ? 'Deudor' : 'Al día'}
                  </span>
                  {client.estado === 'deudor' && (
                    <span className="text-xs font-semibold text-destructive">
                      ${client.debt.toLocaleString('es-AR')} adeudado
                    </span>
                  )}
                </div>

                {/* Phone + address */}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {client.phone && (
                    <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                      <Phone className="w-3 h-3 shrink-0" />{client.phone}
                    </span>
                  )}
                  {client.address && (
                    <span className="text-xs text-muted-foreground flex items-center gap-0.5 truncate">
                      <MapPin className="w-3 h-3 shrink-0" />{client.address}
                    </span>
                  )}
                </div>

                {/* Budines by flavor */}
                {client.total_budines > 0 && (
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                    {client.budines_by_flavor.map((b) => (
                      <span key={b.flavor_name} className="text-xs text-muted-foreground">
                        {b.emoji} {b.flavor_name} <span className="font-medium text-foreground">×{b.quantity}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col items-end justify-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 cursor-pointer" onClick={() => openEdit(client)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 cursor-pointer" onClick={() => setDeleteTarget(client)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ClientSheet
        open={sheetOpen}
        onOpenChange={(o) => { setSheetOpen(o); if (!o) setEditingClient(null) }}
        editingClient={editingClient}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(isOpen: boolean) => !isOpen && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará a <strong>{deleteTarget?.name}</strong>. Los pedidos existentes no se eliminarán pero quedarán sin cliente vinculado. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { deleteClient.mutate(deleteTarget!.id); setDeleteTarget(null) }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
