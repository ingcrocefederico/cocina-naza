import { useState } from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

  const [open, setOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<NewIngredientForm>(emptyForm)

  const selected = ingredients.find(i => i.id === value)

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
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">{selected ? selected.name : <span className="text-muted-foreground">Ingrediente...</span>}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start" onWheel={e => e.stopPropagation()}>
          <Command>
            <CommandInput placeholder="Buscar ingrediente..." />
            <CommandList>
              <CommandEmpty>Sin resultados.</CommandEmpty>
              <CommandGroup>
                {ingredients.map(ing => (
                  <CommandItem
                    key={ing.id}
                    value={ing.name}
                    onSelect={() => {
                      onChange(ing.id)
                      setOpen(false)
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === ing.id ? 'opacity-100' : 'opacity-0')} />
                    <span>{ing.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{formatUnit(ing.unit)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {allowCreate && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        setOpen(false)
                        setDialogOpen(true)
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Nuevo ingrediente
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

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
              <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v as Unit }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Button
              onClick={handleCreate}
              disabled={!form.name || createIngredient.isPending}
            >
              {createIngredient.isPending ? 'Creando...' : 'Crear y seleccionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
