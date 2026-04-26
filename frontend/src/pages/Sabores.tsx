import { useState, useEffect } from 'react'
import {
  useFlavors, useCreateFlavor, useUpdateFlavor, useDeleteFlavor,
  useFlavorRecipe, useSaveFlavorRecipe,
} from '../hooks/useFlavors'
import { useIngredients } from '../hooks/useIngredients'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { IngredientCombobox } from '@/components/IngredientCombobox'
import { Trash2, Plus } from 'lucide-react'
import type { Flavor, RecipeItem } from '../types'

function formatARS(value: string) {
  const n = parseFloat(value)
  if (isNaN(n)) return '—'
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

interface FlavorForm {
  name: string
  emoji: string
  price_per_budin: string
}

interface RecipeRow {
  key: number
  ingredient_id: string
  quantity_per_budin: string
}

const emptyForm: FlavorForm = { name: '', emoji: '', price_per_budin: '' }
let rowKey = 0

export default function Sabores() {
  const { data: flavors = [], isLoading } = useFlavors()
  const createFlavor = useCreateFlavor()
  const updateFlavor = useUpdateFlavor()
  const deleteFlavor = useDeleteFlavor()
  const saveRecipe = useSaveFlavorRecipe()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Flavor | null>(null)
  const [form, setForm] = useState<FlavorForm>(emptyForm)
  const [rows, setRows] = useState<RecipeRow[]>([])

  const { data: existingRecipe } = useFlavorRecipe(editing?.id ?? null)

  useEffect(() => {
    if (existingRecipe) {
      setRows(existingRecipe.map((r: RecipeItem) => ({
        key: rowKey++,
        ingredient_id: r.ingredient_id,
        quantity_per_budin: String(r.quantity_per_budin),
      })))
    }
  }, [existingRecipe])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setRows([])
    setOpen(true)
  }

  function openEdit(flavor: Flavor) {
    setEditing(flavor)
    setForm({ name: flavor.name, emoji: flavor.emoji, price_per_budin: flavor.price_per_budin })
    setRows([])
    setOpen(true)
  }

  function addRow() {
    setRows(r => [...r, { key: rowKey++, ingredient_id: '', quantity_per_budin: '' }])
  }

  function removeRow(key: number) {
    setRows(r => r.filter(row => row.key !== key))
  }

  function updateRow(key: number, field: 'ingredient_id' | 'quantity_per_budin', value: string) {
    setRows(r => r.map(row => row.key === key ? { ...row, [field]: value } : row))
  }

  async function handleSave() {
    const validRows = rows.filter(r => r.ingredient_id && r.quantity_per_budin)
    const recipeItems = validRows.map(r => ({
      ingredient_id: r.ingredient_id,
      quantity_per_budin: parseFloat(r.quantity_per_budin),
    }))

    if (editing) {
      await updateFlavor.mutateAsync({ id: editing.id, ...form })
      await saveRecipe.mutateAsync({ id: editing.id, items: recipeItems })
    } else {
      const res = await createFlavor.mutateAsync(form)
      const newId: string = res.data.id
      if (recipeItems.length > 0) {
        await saveRecipe.mutateAsync({ id: newId, items: recipeItems })
      }
    }
    setOpen(false)
  }

  const isSaving = createFlavor.isPending || updateFlavor.isPending || saveRecipe.isPending

  if (isLoading) return <div className="text-muted-foreground">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Sabores de budín</h1>
        <Button onClick={openCreate} size="sm" className="cursor-pointer">
          <Plus className="w-4 h-4 mr-1" /> Nuevo sabor
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {flavors.map(flavor => (
          <Card
            key={flavor.id}
            className="cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => openEdit(flavor)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-foreground">
                <span className="text-xl">{flavor.emoji}</span>
                {flavor.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-3 text-xs">
                  <span className="text-muted-foreground">
                    Venta <span className="text-foreground font-semibold">{formatARS(flavor.price_per_budin)}</span>
                  </span>
                  <span className="text-muted-foreground">
                    Costo{' '}
                    {parseFloat(flavor.cost_per_budin) > 0
                      ? <span className="text-foreground font-medium">{formatARS(flavor.cost_per_budin)}</span>
                      : <span className="text-muted-foreground/60">—</span>
                    }
                  </span>
                  <span className="text-muted-foreground">
                    Gan.{' '}
                    <span className={parseFloat(flavor.profit_per_budin) >= 0 ? 'font-semibold text-green-500' : 'font-semibold text-destructive'}>
                      {formatARS(flavor.profit_per_budin)}
                    </span>
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="cursor-pointer shrink-0"
                  onClick={e => { e.stopPropagation(); deleteFlavor.mutate(flavor.id) }}
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? 'Editar sabor' : 'Nuevo sabor'}</SheetTitle>
          </SheetHeader>

          <div className="space-y-4 py-4">
            {editing && (
              <div className="grid grid-cols-3 gap-2 rounded-lg border p-3 bg-muted/30 text-center">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Venta</p>
                  <p className="text-sm font-semibold text-foreground">{formatARS(editing.price_per_budin)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Costo</p>
                  <p className="text-sm font-medium text-foreground">
                    {parseFloat(editing.cost_per_budin) > 0 ? formatARS(editing.cost_per_budin) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Ganancia</p>
                  <p className={`text-sm font-semibold ${parseFloat(editing.profit_per_budin) >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                    {formatARS(editing.profit_per_budin)}
                  </p>
                </div>
              </div>
            )}
            {/* Datos del sabor */}
            <div className="grid grid-cols-[1fr_80px] gap-3">
              <div className="space-y-1">
                <Label>Nombre</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Vainilla y Chips"
                />
              </div>
              <div className="space-y-1">
                <Label>Emoji</Label>
                <Input
                  value={form.emoji}
                  onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
                  placeholder="🍦"
                  className="text-center text-xl"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Precio por budín ($)</Label>
              <Input
                type="number"
                value={form.price_per_budin}
                onChange={e => setForm(f => ({ ...f, price_per_budin: e.target.value }))}
                placeholder="5500"
              />
            </div>

            <Separator />

            {/* Receta */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-foreground">Receta</Label>
                <Button variant="outline" size="sm" className="cursor-pointer" onClick={addRow}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Ingrediente
                </Button>
              </div>

              {rows.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Sin ingredientes. Agregá uno con el botón.
                </p>
              )}

              {rows.map(row => (
                <IngredientRow
                  key={row.key}
                  row={row}
                  onUpdate={updateRow}
                  onRemove={removeRow}
                />
              ))}
            </div>
          </div>

          <SheetFooter className="gap-2">
            <Button variant="outline" className="cursor-pointer" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="cursor-pointer" onClick={handleSave} disabled={!form.name || isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}

interface IngredientRowProps {
  row: RecipeRow
  onUpdate: (key: number, field: 'ingredient_id' | 'quantity_per_budin', value: string) => void
  onRemove: (key: number) => void
}

function IngredientRow({ row, onUpdate, onRemove }: IngredientRowProps) {
  const { data: ingredients = [] } = useIngredients()
  const ing = ingredients.find(i => i.id === row.ingredient_id)

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <IngredientCombobox
          value={row.ingredient_id}
          onChange={id => onUpdate(row.key, 'ingredient_id', id)}
          allowCreate
        />
      </div>
      <Input
        type="number"
        className="w-24"
        placeholder="0"
        value={row.quantity_per_budin}
        onChange={e => onUpdate(row.key, 'quantity_per_budin', e.target.value)}
      />
      {ing && (
        <Badge variant="secondary" className="w-14 justify-center shrink-0">
          {ing.unit}
        </Badge>
      )}
      <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => onRemove(row.key)}>
        <Trash2 className="w-3.5 h-3.5 text-destructive" />
      </Button>
    </div>
  )
}
