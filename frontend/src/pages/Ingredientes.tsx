import { useState } from 'react'
import { useIngredients, useCreateIngredient, useUpdateIngredient, useDeleteIngredient } from '../hooks/useIngredients'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectSheet } from '@/components/ui/select-sheet'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Calculator, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Ingredient, Unit } from '../types'

const UNITS: Unit[] = ['kg', 'g', 'L', 'ml', 'unidad']

function formatUnit(unit: string): string {
  return unit === 'unidad' ? 'uni' : unit
}

const CALC_TARGETS: Record<string, string[]> = {
  kg: ['g'],
  g: ['kg'],
  L: ['ml'],
  ml: ['L'],
}

const CONVERSION_FACTOR: Record<string, number> = {
  'kg->g':  0.001,
  'g->kg':  1000,
  'L->ml':  0.001,
  'ml->L':  1000,
}

interface IngredientForm {
  name: string
  unit: Unit
  price_per_unit: string
}

const emptyForm: IngredientForm = { name: '', unit: 'kg', price_per_unit: '' }

export default function Ingredientes() {
  const { data: ingredients = [], isLoading } = useIngredients()
  const createIngredient = useCreateIngredient()
  const updateIngredient = useUpdateIngredient()
  const deleteIngredient = useDeleteIngredient()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Ingredient | null>(null)
  const [form, setForm] = useState<IngredientForm>(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState<Ingredient | null>(null)

  const [calcOpen, setCalcOpen] = useState(false)
  const [calcPrice, setCalcPrice] = useState('')
  const [calcSource, setCalcSource] = useState('kg')
  const [calcTarget, setCalcTarget] = useState('g')

  function handleCalcSourceChange(src: string) {
    setCalcSource(src)
    const targets = CALC_TARGETS[src] ?? []
    if (!targets.includes(calcTarget)) setCalcTarget(targets[0] ?? '')
  }

  const calcResult = (() => {
    const price = parseFloat(calcPrice)
    const factor = CONVERSION_FACTOR[`${calcSource}->${calcTarget}`]
    if (!calcPrice || isNaN(price) || price <= 0 || !factor) return null
    return price * factor
  })()

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setSheetOpen(true)
  }

  function openEdit(ingredient: Ingredient) {
    setEditing(ingredient)
    setForm({
      name: ingredient.name,
      unit: ingredient.unit,
      price_per_unit: ingredient.price_per_unit,
    })
    setSheetOpen(true)
  }

  async function handleSave() {
    if (!form.name || !form.unit) return
    if (editing) {
      await updateIngredient.mutateAsync({ id: editing.id, ...form })
    } else {
      await createIngredient.mutateAsync(form)
    }
    setSheetOpen(false)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteIngredient.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  const isSaving = createIngredient.isPending || updateIngredient.isPending

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Ingredientes</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCalcOpen(true)} className="cursor-pointer">
            <Calculator className="w-4 h-4 mr-1" /> Calculadora
          </Button>
          <Button size="sm" onClick={openCreate} className="cursor-pointer">
            <Plus className="w-4 h-4 mr-1" /> Nuevo ingrediente
          </Button>
        </div>
      </div>

      {isLoading && <div className="text-muted-foreground">Cargando...</div>}

      {!isLoading && ingredients.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          Sin ingredientes. Agregá el primero.
        </div>
      )}

      {ingredients.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead>Precio / unidad</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ingredients.map(ing => (
              <TableRow key={ing.id}>
                <TableCell className="font-medium">{ing.name}</TableCell>
                <TableCell className="text-muted-foreground">{formatUnit(ing.unit)}</TableCell>
                <TableCell>
                  {ing.price_per_unit && parseFloat(ing.price_per_unit) > 0
                    ? `$${parseFloat(ing.price_per_unit).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                    : <span className="text-muted-foreground">—</span>
                  }
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => openEdit(ing)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => setDeleteTarget(ing)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Calculadora de precios */}
      <Sheet open={calcOpen} onOpenChange={setCalcOpen}>
        <SheetContent side="bottom" className="flex flex-col gap-0 p-0 rounded-t-2xl">
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-muted-foreground/25 shrink-0" />
          <SheetHeader className="px-5 pt-3 pb-4 shrink-0">
            <SheetTitle className="text-base">Calculadora de precios</SheetTitle>
          </SheetHeader>

          <div className="px-5 pb-8 space-y-5">
            {/* Entrada */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Precio de compra</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={calcPrice}
                    onChange={e => setCalcPrice(e.target.value)}
                    className="pl-7"
                  />
                </div>
                <SelectSheet
                  value={calcSource}
                  onValueChange={handleCalcSourceChange}
                  options={Object.keys(CALC_TARGETS).map(u => ({ value: u, label: u }))}
                  title="Unidad de origen"
                  className="w-24 shrink-0"
                />
              </div>
            </div>

            {/* Resultado */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Equivale a</Label>
              <div className="flex gap-2 items-center">
                <div className={`flex-1 rounded-lg border px-4 py-3 text-lg font-bold tabular-nums transition-colors ${calcResult !== null ? 'bg-muted/50 text-foreground border-border' : 'bg-muted/20 text-muted-foreground border-dashed border-border'}`}>
                  {calcResult !== null
                    ? `$${calcResult.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}`
                    : '—'}
                </div>
                <SelectSheet
                  value={calcTarget}
                  onValueChange={setCalcTarget}
                  options={(CALC_TARGETS[calcSource] ?? []).map(u => ({ value: u, label: u }))}
                  title="Unidad destino"
                  className="w-24 shrink-0"
                />
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet add/edit */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? 'Editar ingrediente' : 'Nuevo ingrediente'}</SheetTitle>
          </SheetHeader>

          <div className="space-y-4 py-4">
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
              <Label>
                Precio por unidad <span className="text-muted-foreground text-xs">(opcional)</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.price_per_unit}
                onChange={e => setForm(f => ({ ...f, price_per_unit: e.target.value }))}
              />
            </div>
          </div>

          <SheetFooter className="gap-2">
            <Button variant="outline" className="cursor-pointer" onClick={() => setSheetOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="cursor-pointer"
              onClick={handleSave}
              disabled={!form.name || isSaving}
            >
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar ingrediente?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deleteTarget?.name}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
