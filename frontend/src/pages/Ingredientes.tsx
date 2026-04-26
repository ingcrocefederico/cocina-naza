import { useState } from 'react'
import { useIngredients, useCreateIngredient, useUpdateIngredient, useDeleteIngredient } from '../hooks/useIngredients'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectSheet } from '@/components/ui/select-sheet'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { Ingredient, Unit } from '../types'

const UNITS: Unit[] = ['kg', 'g', 'L', 'ml', 'unidad']

function formatUnit(unit: string): string {
  return unit === 'unidad' ? 'uni' : unit
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
        <Button size="sm" onClick={openCreate} className="cursor-pointer">
          <Plus className="w-4 h-4 mr-1" /> Nuevo ingrediente
        </Button>
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
