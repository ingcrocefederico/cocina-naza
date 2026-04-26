import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { SelectSheet } from '@/components/ui/select-sheet'
import { useIngredients, useCreateIngredient } from '@/hooks/useIngredients'
import type { Unit } from '@/types'

interface Props {
  value: string
  onChange: (id: string) => void
  allowCreate?: boolean
}

const UNITS: Unit[] = ['kg', 'g', 'L', 'ml', 'unidad']

function formatUnit(unit: string): string {
  return unit === 'unidad' ? 'uni' : unit
}

interface NewIngredientForm {
  name: string
  unit: Unit
  price_per_unit: string
}

const emptyForm: NewIngredientForm = { name: '', unit: 'kg', price_per_unit: '' }

export function IngredientCombobox({ value, onChange, allowCreate = false }: Props) {
  const { data: ingredients = [] } = useIngredients()
  const createIngredient = useCreateIngredient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<NewIngredientForm>(emptyForm)

  async function handleCreate() {
    if (!form.name || !form.unit) return
    const res = await createIngredient.mutateAsync({
      name: form.name,
      unit: form.unit,
      price_per_unit: form.price_per_unit || '0',
    })
    onChange(res.data.id)
    setDialogOpen(false)
    setForm(emptyForm)
  }

  return (
    <>
      <SelectSheet
        value={value}
        onValueChange={onChange}
        options={ingredients.map(i => ({ value: i.id, label: i.name, sublabel: formatUnit(i.unit) }))}
        placeholder="Ingrediente..."
        title="Ingrediente"
        searchable
        onCreate={allowCreate ? () => setDialogOpen(true) : undefined}
        createLabel="Nuevo ingrediente"
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuevo ingrediente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input
                placeholder="Harina 000"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Unidad</Label>
              <SelectSheet
                value={form.unit}
                onValueChange={v => setForm(f => ({ ...f, unit: v as Unit }))}
                options={UNITS.map(u => ({ value: u, label: formatUnit(u) }))}
                title="Unidad"
              />
            </div>
            <div className="space-y-1">
              <Label>Precio por unidad <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.price_per_unit}
                onChange={e => setForm(f => ({ ...f, price_per_unit: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!form.name || createIngredient.isPending}>
              {createIngredient.isPending ? 'Creando...' : 'Crear y seleccionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
