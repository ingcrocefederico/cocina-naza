import { useState, useEffect, useRef } from 'react'
import {
  useFlavors, useCreateFlavor, useUpdateFlavor, useDeleteFlavor,
  useFlavorRecipe, useSaveFlavorRecipe,
} from '../hooks/useFlavors'
import { useIngredients } from '../hooks/useIngredients'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { IngredientCombobox } from '@/components/IngredientCombobox'
import { Trash2, Plus, ChefHat, Lock, LockOpen } from 'lucide-react'
import type { Flavor, RecipeItem, Unit } from '../types'

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

interface CommonItemState {
  ingredient_id: string
  ingredient_name: string
  unit: Unit
  quantity_per_budin: number
  override_quantity: string
  is_overridden: boolean
  is_deleted: boolean
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
  const [commonItems, setCommonItems] = useState<CommonItemState[]>([])

  const [deleteTarget, setDeleteTarget] = useState<Flavor | null>(null)
  const [removeRowTarget, setRemoveRowTarget] = useState<RecipeRow | null>(null)
  const [removeCommonTarget, setRemoveCommonTarget] = useState<CommonItemState | null>(null)

  const { data: allIngredients = [] } = useIngredients()

  const [recipeFlavorId, setRecipeFlavorId] = useState<string | null>(null)
  const [recipeOpen, setRecipeOpen] = useState(false)
  const { data: recipe = [] } = useFlavorRecipe(recipeFlavorId)

  const { data: existingRecipe, isFetching: recipeFetching } = useFlavorRecipe(editing?.id ?? null)

  // Populate the editor from the server recipe ONCE per dialog-open. Keyed on the
  // open transition + flavor id (not on existingRecipe identity): React Query
  // returns the same cached array reference when reopening the same flavor, so a
  // plain [existingRecipe] dependency would not re-run and the lists would show
  // empty even though the data is loaded. Guarding by key also prevents a
  // background refetch from clobbering the user's in-progress edits.
  const populatedKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!open || !editing) {
      populatedKeyRef.current = null
      return
    }
    if (!existingRecipe) return
    if (populatedKeyRef.current === editing.id) return
    populatedKeyRef.current = editing.id
    setCommonItems(
      existingRecipe
        .filter((r: RecipeItem) => r.is_common)
        .map((r: RecipeItem) => ({
          ingredient_id: r.ingredient_id,
          ingredient_name: r.ingredient_name,
          unit: r.unit,
          quantity_per_budin: r.quantity_per_budin,
          override_quantity: r.is_overridden ? String(Math.round(Number(r.quantity_per_budin))) : '',
          is_overridden: r.is_overridden,
          is_deleted: r.is_deleted,
        }))
    )
    setRows(
      existingRecipe
        .filter((r: RecipeItem) => !r.is_common)
        .map((r: RecipeItem) => ({
          key: rowKey++,
          ingredient_id: r.ingredient_id,
          quantity_per_budin: String(Math.round(Number(r.quantity_per_budin))),
        }))
    )
  }, [open, editing, existingRecipe])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setRows([])
    setCommonItems([])
    setOpen(true)
  }

  function openEdit(flavor: Flavor) {
    setEditing(flavor)
    setForm({ name: flavor.name, emoji: flavor.emoji, price_per_budin: flavor.price_per_budin })
    setRows([])
    setCommonItems([])
    setOpen(true)
  }

  function addRow() {
    setRows(r => [...r, { key: rowKey++, ingredient_id: '', quantity_per_budin: '' }])
  }

  function removeRow(key: number) {
    setRows(r => r.filter(row => row.key !== key))
  }

  function requestRemoveRow(key: number) {
    const row = rows.find(r => r.key === key)
    if (!row || !row.ingredient_id) {
      removeRow(key)
    } else {
      setRemoveRowTarget(row)
    }
  }

  function updateRow(key: number, field: 'ingredient_id' | 'quantity_per_budin', value: string) {
    setRows(r => r.map(row => row.key === key ? { ...row, [field]: value } : row))
  }

  function unlockCommon(ingredient_id: string) {
    setCommonItems(items =>
      items.map(item =>
        item.ingredient_id === ingredient_id
          ? { ...item, is_overridden: true, override_quantity: String(Math.round(item.quantity_per_budin)) }
          : item
      )
    )
  }

  function lockCommon(ingredient_id: string) {
    setCommonItems(items =>
      items.map(item =>
        item.ingredient_id === ingredient_id
          ? { ...item, is_overridden: false, override_quantity: '' }
          : item
      )
    )
  }

  function updateCommonOverride(ingredient_id: string, value: string) {
    setCommonItems(items =>
      items.map(item =>
        item.ingredient_id === ingredient_id
          ? { ...item, override_quantity: value.replace(/[^0-9]/g, '') }
          : item
      )
    )
  }

  function deleteCommon(ingredient_id: string) {
    setCommonItems(items =>
      items.map(item =>
        item.ingredient_id === ingredient_id
          ? { ...item, is_deleted: true, is_overridden: false, override_quantity: '' }
          : item
      )
    )
  }

  async function handleSave() {
    const overrideItems = commonItems
      .filter(c => c.is_overridden && c.override_quantity)
      .map(c => ({ ingredient_id: c.ingredient_id, quantity_per_budin: parseFloat(c.override_quantity) }))

    const deletedItems = commonItems
      .filter(c => c.is_deleted)
      .map(c => ({ ingredient_id: c.ingredient_id, quantity_per_budin: 0 }))

    const exclusiveItems = rows
      .filter(r => r.ingredient_id && r.quantity_per_budin)
      .map(r => ({ ingredient_id: r.ingredient_id, quantity_per_budin: parseFloat(r.quantity_per_budin) }))

    const recipeItems = [...overrideItems, ...deletedItems, ...exclusiveItems]

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

  async function handleToggleCommon(value: boolean) {
    if (!editing) return
    await updateFlavor.mutateAsync({ id: editing.id, uses_common_ingredients: value })
    setEditing(prev => prev ? { ...prev, uses_common_ingredients: value } : null)
    if (!value) setCommonItems([])
  }

  const isSaving = createFlavor.isPending || updateFlavor.isPending || saveRecipe.isPending

  const recipeFlavor = recipeFlavorId ? (flavors.find(f => f.id === recipeFlavorId) ?? null) : null

  if (isLoading) return <div className="text-muted-foreground">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Sabores de budín</h1>
        <Button onClick={openCreate} size="sm" className="cursor-pointer">
          <Plus className="w-4 h-4 mr-1" /> Nuevo sabor
        </Button>
      </div>

      <Tabs defaultValue="comunes">
        <TabsList className="mb-3">
          <TabsTrigger value="comunes">Comunes</TabsTrigger>
          <TabsTrigger value="integral">Integral</TabsTrigger>
        </TabsList>

        <TabsContent value="comunes">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {flavors.filter(f => !f.name.startsWith('(Int)')).map(flavor => (
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
                    onClick={e => { e.stopPropagation(); setDeleteTarget(flavor) }}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="integral">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {flavors.filter(f => f.name.startsWith('(Int)')).map(flavor => (
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
                        onClick={e => { e.stopPropagation(); setDeleteTarget(flavor) }}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Sheet editar / crear sabor */}
      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null) }}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 pt-6 pb-4">
            <SheetTitle>{editing ? 'Editar sabor' : 'Nuevo sabor'}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
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
                type="text"
                inputMode="numeric"
                value={
                  form.price_per_budin
                    ? parseFloat(form.price_per_budin).toLocaleString('es-AR', { maximumFractionDigits: 0 })
                    : ''
                }
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9]/g, '')
                  setForm(f => ({ ...f, price_per_budin: raw }))
                }}
                placeholder="5.500"
              />
            </div>

            <Separator />

            <div className="space-y-3">
              {editing && (
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-foreground">Ingredientes comunes</Label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={editing.uses_common_ingredients}
                      onChange={e => handleToggleCommon(e.target.checked)}
                      className="cursor-pointer"
                    />
                    Usar comunes
                  </label>
                </div>
              )}

              {editing?.uses_common_ingredients && commonItems.some(c => !c.is_deleted) && (
                <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
                  {commonItems.filter(c => !c.is_deleted).map(item => (
                    <div key={item.ingredient_id} className="flex items-center gap-2">
                      <span className="flex-1 min-w-0 text-sm text-foreground truncate">{item.ingredient_name}</span>
                      {item.is_overridden ? (
                        <Input
                          type="text"
                          inputMode="numeric"
                          className="w-20 shrink-0"
                          value={item.override_quantity}
                          onChange={e => updateCommonOverride(item.ingredient_id, e.target.value)}
                        />
                      ) : (
                        <span className="w-20 shrink-0 text-sm text-muted-foreground text-right tabular-nums">
                          {item.quantity_per_budin}
                        </span>
                      )}
                      <Badge variant="secondary" className="w-10 justify-center shrink-0 text-xs">
                        {item.unit === 'unidad' ? 'uni' : item.unit}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="cursor-pointer shrink-0"
                        onClick={() => item.is_overridden ? lockCommon(item.ingredient_id) : unlockCommon(item.ingredient_id)}
                      >
                        {item.is_overridden
                          ? <LockOpen className="w-3.5 h-3.5 text-amber-500" />
                          : <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                        }
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="cursor-pointer shrink-0"
                        onClick={() => setRemoveCommonTarget(item)}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-foreground">
                  {editing?.uses_common_ingredients ? 'Ingredientes propios' : 'Receta'}
                </Label>
                <Button variant="outline" size="sm" className="cursor-pointer" onClick={addRow}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Ingrediente
                </Button>
              </div>

              {rows.length === 0 && editing && recipeFetching && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Cargando ingredientes…
                </p>
              )}

              {rows.length === 0 && !(editing && recipeFetching) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Sin ingredientes. Agregá uno con el botón.
                </p>
              )}

              {rows.map(row => (
                <IngredientRow
                  key={row.key}
                  row={row}
                  onUpdate={updateRow}
                  onRemove={requestRemoveRow}
                />
              ))}
            </div>
          </div>

          <SheetFooter className="gap-2 px-6 py-4 border-t border-border">
            <Button variant="outline" className="cursor-pointer" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="cursor-pointer" onClick={handleSave} disabled={!form.name || isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Sheet receta — solo lectura */}
      <Sheet
        open={recipeOpen}
        onOpenChange={open => {
          setRecipeOpen(open)
          if (!open) setRecipeFlavorId(null)
        }}
      >
        <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          {recipeFlavor && (
            <>
              <SheetHeader className="px-6 pt-6 pb-4">
                <SheetTitle className="flex items-center gap-2">
                  <span className="text-xl">{recipeFlavor.emoji}</span>
                  {recipeFlavor.name}
                </SheetTitle>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                {/* Preparación */}
                {recipeFlavor.preparation ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preparación</p>
                    <ol className="space-y-2">
                      {recipeFlavor.preparation.split('\n').map((step, i) => (
                        <li key={i} className="text-sm text-foreground leading-snug">
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin receta cargada aún.</p>
                )}

                {/* Ingredientes */}
                {recipe.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ingredientes</p>
                      {recipe.map(item => (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                          <span className="text-foreground">{item.ingredient_name}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {Math.round(Number(item.quantity_per_budin))} {formatUnit(item.unit)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Costos — solo si hay ingredientes con precio */}
                {recipe.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Costos</p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Costo total</span>
                        <span className="font-medium tabular-nums">{formatARS(recipeFlavor.cost_per_budin)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Precio de venta</span>
                        <span className="font-medium tabular-nums">{formatARS(recipeFlavor.price_per_budin)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <span className="text-muted-foreground">Ganancia</span>
                        <span className={`tabular-nums ${parseFloat(recipeFlavor.profit_per_budin) >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                          {formatARS(recipeFlavor.profit_per_budin)}
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

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="¿Eliminar sabor?"
        description={
          <>
            Se eliminará <strong>{deleteTarget?.name}</strong>. Esta acción no se puede deshacer.
          </>
        }
        onConfirm={() => { deleteFlavor.mutate(deleteTarget!.id); setDeleteTarget(null) }}
      />

      <ConfirmDialog
        open={!!removeRowTarget}
        onOpenChange={(open) => !open && setRemoveRowTarget(null)}
        title="¿Quitar ingrediente de la receta?"
        confirmText="Quitar"
        description={
          <>
            <strong>{allIngredients.find(i => i.id === removeRowTarget?.ingredient_id)?.name ?? 'Este ingrediente'}</strong> dejará de formar parte de la receta. Tomará efecto al guardar.
          </>
        }
        onConfirm={() => {
          if (removeRowTarget) removeRow(removeRowTarget.key)
          setRemoveRowTarget(null)
        }}
      />

      <ConfirmDialog
        open={!!removeCommonTarget}
        onOpenChange={(open) => !open && setRemoveCommonTarget(null)}
        title="¿Quitar ingrediente común?"
        confirmText="Quitar"
        description={
          <>
            <strong>{removeCommonTarget?.ingredient_name}</strong> dejará de aplicarse a este sabor. Tomará efecto al guardar.
          </>
        }
        onConfirm={() => {
          if (removeCommonTarget) deleteCommon(removeCommonTarget.ingredient_id)
          setRemoveCommonTarget(null)
        }}
      />
    </div>
  )
}

interface IngredientRowProps {
  row: RecipeRow
  onUpdate: (key: number, field: 'ingredient_id' | 'quantity_per_budin', value: string) => void
  onRemove: (key: number) => void
}

function formatUnit(unit: string): string {
  return unit === 'unidad' ? 'uni' : unit
}

function IngredientRow({ row, onUpdate, onRemove }: IngredientRowProps) {
  const { data: ingredients = [] } = useIngredients()
  const ing = ingredients.find(i => i.id === row.ingredient_id)

  return (
    <div className="flex items-center gap-2">
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
      <Button
        variant="ghost"
        size="sm"
        className="cursor-pointer shrink-0"
        onClick={() => onRemove(row.key)}
      >
        <Trash2 className="w-3.5 h-3.5 text-destructive" />
      </Button>
    </div>
  )
}
