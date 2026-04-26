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
import { Trash2, Plus, ChefHat } from 'lucide-react'
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
  const [activeRowKey, setActiveRowKey] = useState<number | null>(null)
  const [rows, setRows] = useState<RecipeRow[]>([])

  const [recipeFlavorId, setRecipeFlavorId] = useState<string | null>(null)
  const [recipeOpen, setRecipeOpen] = useState(false)
  const { data: recipe = [] } = useFlavorRecipe(recipeFlavorId)

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

  const recipeFlavor = recipeFlavorId ? (flavors.find(f => f.id === recipeFlavorId) ?? null) : null
  const recipeTotalCost = recipe.reduce(
    (sum, item) => sum + item.quantity_per_budin * parseFloat(item.price_per_unit || '0'),
    0
  )

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
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer"
                    onClick={e => {
                      e.stopPropagation()
                      setRecipeFlavorId(flavor.id)
                      setRecipeOpen(true)
                    }}
                  >
                    <ChefHat className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer"
                    onClick={e => { e.stopPropagation(); deleteFlavor.mutate(flavor.id) }}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
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
                  isActive={activeRowKey === row.key}
                  onActivate={() => setActiveRowKey(k => k === row.key ? null : row.key)}
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

      {/* Sheet de receta — solo lectura */}
      <Sheet
        open={recipeOpen}
        onOpenChange={open => {
          setRecipeOpen(open)
          if (!open) setRecipeFlavorId(null)
        }}
      >
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {recipeFlavor && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span className="text-xl">{recipeFlavor.emoji}</span>
                  {recipeFlavor.name}
                </SheetTitle>
              </SheetHeader>

              <div className="py-4">
                {recipe.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sin receta cargada aún.</p>
                ) : (
                  <>
                    {/* Encabezado de columnas */}
                    <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-1 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                      <span>Ingrediente</span>
                      <span className="text-right">Cantidad</span>
                      <span className="text-right w-20">Costo</span>
                    </div>

                    {/* Filas de ingredientes */}
                    {recipe.map(item => {
                      const price = parseFloat(item.price_per_unit || '0')
                      const itemCost = item.quantity_per_budin * price
                      return (
                        <div
                          key={item.id}
                          className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-1 py-2.5 border-b border-border text-sm"
                        >
                          <span className="text-foreground">{item.ingredient_name}</span>
                          <span className="text-right text-muted-foreground tabular-nums whitespace-nowrap">
                            {item.quantity_per_budin} {formatUnit(item.unit)}
                          </span>
                          <span className="text-right tabular-nums w-20">
                            {price === 0
                              ? <span className="text-muted-foreground">—</span>
                              : formatARS(String(itemCost))
                            }
                          </span>
                        </div>
                      )
                    })}

                    <Separator className="my-3" />

                    {/* Totales */}
                    <div className="space-y-2 px-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Costo total</span>
                        <span className="font-medium tabular-nums">{formatARS(String(recipeTotalCost))}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Precio de venta</span>
                        <span className="font-medium tabular-nums">{formatARS(recipeFlavor.price_per_budin)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <span className="text-muted-foreground">Ganancia</span>
                        <span
                          className={`tabular-nums ${
                            parseFloat(recipeFlavor.price_per_budin) - recipeTotalCost >= 0
                              ? 'text-green-500'
                              : 'text-destructive'
                          }`}
                        >
                          {formatARS(String(parseFloat(recipeFlavor.price_per_budin) - recipeTotalCost))}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

interface IngredientRowProps {
  row: RecipeRow
  isActive: boolean
  onActivate: () => void
  onUpdate: (key: number, field: 'ingredient_id' | 'quantity_per_budin', value: string) => void
  onRemove: (key: number) => void
}

function formatUnit(unit: string): string {
  return unit === 'unidad' ? 'uni' : unit
}

function IngredientRow({ row, isActive, onActivate, onUpdate, onRemove }: IngredientRowProps) {
  const { data: ingredients = [] } = useIngredients()
  const ing = ingredients.find(i => i.id === row.ingredient_id)

  return (
    <div
      className="relative flex items-center gap-2"
      onClick={onActivate}
    >
      <div className="flex-1 min-w-0">
        <IngredientCombobox
          value={row.ingredient_id}
          onChange={id => onUpdate(row.key, 'ingredient_id', id)}
          allowCreate
        />
      </div>
      <Input
        type="text"
        inputMode="numeric"
        className="w-20 shrink-0"
        placeholder="0"
        value={row.quantity_per_budin}
        onChange={e => onUpdate(row.key, 'quantity_per_budin', e.target.value.replace(/[^0-9]/g, ''))}
      />
      {ing && (
        <Badge variant="secondary" className="w-10 justify-center shrink-0 text-xs">
          {formatUnit(ing.unit)}
        </Badge>
      )}
      {isActive && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-0 top-1/2 -translate-y-1/2 cursor-pointer bg-background"
          onClick={e => { e.stopPropagation(); onRemove(row.key) }}
        >
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
        </Button>
      )}
    </div>
  )
}
