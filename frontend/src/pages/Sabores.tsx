import { useState } from 'react'
import { useFlavors, useCreateFlavor, useUpdateFlavor, useDeleteFlavor } from '../hooks/useFlavors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Trash2, Pencil, Plus } from 'lucide-react'
import type { Flavor } from '../types'

interface FlavorFormData {
  name: string
  emoji: string
  price_per_budin: string
}

const empty: FlavorFormData = { name: '', emoji: '', price_per_budin: '' }

export default function Sabores() {
  const { data: flavors = [], isLoading } = useFlavors()
  const createFlavor = useCreateFlavor()
  const updateFlavor = useUpdateFlavor()
  const deleteFlavor = useDeleteFlavor()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Flavor | null>(null)
  const [form, setForm] = useState<FlavorFormData>(empty)

  function openCreate() {
    setEditing(null)
    setForm(empty)
    setOpen(true)
  }

  function openEdit(flavor: Flavor) {
    setEditing(flavor)
    setForm({ name: flavor.name, emoji: flavor.emoji, price_per_budin: flavor.price_per_budin })
    setOpen(true)
  }

  async function handleSubmit() {
    const payload = { ...form }
    if (editing) {
      await updateFlavor.mutateAsync({ id: editing.id, ...payload })
    } else {
      await createFlavor.mutateAsync(payload)
    }
    setOpen(false)
  }

  if (isLoading) return <div className="text-slate-500">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Sabores de budín</h1>
        <Button onClick={openCreate} size="sm"><Plus className="w-4 h-4 mr-1" /> Nuevo sabor</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {flavors.map(flavor => (
          <Card key={flavor.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="text-xl">{flavor.emoji}</span>
                {flavor.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">
                ${parseFloat(flavor.price_per_budin).toLocaleString('es-AR')}
              </span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(flavor)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteFlavor.mutate(flavor.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar sabor' : 'Nuevo sabor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nombre</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Vainilla" />
            </div>
            <div>
              <Label>Emoji</Label>
              <Input value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} placeholder="🍦" className="w-24" />
            </div>
            <div>
              <Label>Precio por budín ($)</Label>
              <Input type="number" value={form.price_per_budin} onChange={e => setForm(f => ({ ...f, price_per_budin: e.target.value }))} placeholder="1500" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.name}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
