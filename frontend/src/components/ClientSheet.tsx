import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateClient, useUpdateClient } from '../hooks/useClients'
import type { Client } from '../types'

const schema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface ClientSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingClient?: Client | null
  onSuccess?: (client: Client) => void
}

export default function ClientSheet({ open, onOpenChange, editingClient, onSuccess }: ClientSheetProps) {
  const isEdit = !!editingClient
  const createClient = useCreateClient()
  const updateClient = useUpdateClient()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', phone: '', address: '', notes: '' },
  })

  useEffect(() => {
    if (open) {
      reset(
        editingClient
          ? {
              name: editingClient.name,
              phone: editingClient.phone ?? '',
              address: editingClient.address ?? '',
              notes: editingClient.notes ?? '',
            }
          : { name: '', phone: '', address: '', notes: '' }
      )
    }
  }, [open, editingClient, reset])

  async function onSubmit(data: FormValues) {
    const payload = {
      name: data.name,
      phone: data.phone || undefined,
      address: data.address || undefined,
      notes: data.notes || undefined,
    }
    try {
      if (isEdit && editingClient) {
        const res = await updateClient.mutateAsync({ id: editingClient.id, ...payload })
        onSuccess?.(res.data)
      } else {
        const res = await createClient.mutateAsync(payload)
        onSuccess?.(res.data)
      }
      onOpenChange(false)
    } catch {
      // mutation error surfaced by React Query; sheet stays open
    }
  }

  const isPending = createClient.isPending || updateClient.isPending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex flex-col gap-0 p-0 max-h-[90vh] rounded-t-2xl">
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-muted-foreground/25 shrink-0" />
        <SheetHeader className="px-5 pt-3 pb-4 border-b border-border shrink-0">
          <SheetTitle>{isEdit ? 'Editar cliente' : 'Nuevo cliente'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 px-5 py-4 overflow-y-auto">
          <div>
            <Label>Nombre y apellido *</Label>
            <Input {...register('name')} placeholder="María González" className="mt-1" />
            {errors.name && <p className="text-destructive text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <Label>Teléfono</Label>
            <Input {...register('phone')} placeholder="Opcional" className="mt-1" />
          </div>
          <div>
            <Label>Dirección</Label>
            <Input {...register('address')} placeholder="Opcional" className="mt-1" />
          </div>
          <div>
            <Label>Notas</Label>
            <Input {...register('notes')} placeholder="Opcional" className="mt-1" />
          </div>
          <div className="flex gap-2 pt-2 pb-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={isPending}>
              {isEdit ? 'Guardar cambios' : 'Crear cliente'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
