import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { useFlavors } from '../hooks/useFlavors'
import { useCreateOrder, useUpdateOrder, useOrders } from '../hooks/useOrders'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { Trash2, Plus, ArrowLeft } from 'lucide-react'
import type { OrderStatus } from '../types'

const itemSchema = z.object({
  flavor_id: z.string().min(1, 'Elegí un sabor'),
  quantity: z.coerce.number().int().min(1),
})

const schema = z.object({
  client_name: z.string().min(1, 'Nombre requerido'),
  address: z.string().optional(),
  date: z.string().min(1),
  status: z.enum(['pedido', 'preparado', 'entregado', 'cobrado']),
  sale_price: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, 'Agregá al menos un budín'),
})

type FormValues = {
  client_name: string
  address?: string
  date: string
  status: 'pedido' | 'preparado' | 'entregado' | 'cobrado'
  sale_price?: string
  notes?: string
  items: { flavor_id: string; quantity: number }[]
}

const STATUSES: { value: OrderStatus; label: string }[] = [
  { value: 'pedido', label: 'Pedido' },
  { value: 'preparado', label: 'Preparado' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'cobrado', label: 'Cobrado' },
]

export default function PedidoForm() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isEdit = !!id

  const dateFromParams = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd')
  const { data: flavors = [] } = useFlavors()
  const { data: orders = [] } = useOrders(dateFromParams)
  const createOrder = useCreateOrder()
  const updateOrder = useUpdateOrder()

  const existingOrder = useMemo(() => orders.find(o => o.id === id), [orders, id])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      client_name: '',
      address: '',
      date: dateFromParams,
      status: 'pedido',
      sale_price: '',
      notes: '',
      items: [{ flavor_id: '', quantity: 1 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = useWatch({ control, name: 'items' })

  useEffect(() => {
    if (existingOrder) {
      setValue('client_name', existingOrder.client_name)
      setValue('address', existingOrder.address || '')
      setValue('date', existingOrder.date)
      setValue('status', existingOrder.status)
      setValue('sale_price', existingOrder.sale_price || '')
      setValue('notes', existingOrder.notes || '')
      setValue('items', existingOrder.items.map(i => ({ flavor_id: i.flavor_id, quantity: i.quantity })))
    }
  }, [existingOrder, setValue])

  const calculatedPrice = useMemo(() => {
    return watchedItems.reduce((sum, item) => {
      const flavor = flavors.find(f => f.id === item.flavor_id)
      if (!flavor) return sum
      return sum + parseFloat(flavor.price_per_budin) * (item.quantity || 0)
    }, 0)
  }, [watchedItems, flavors])

  const [priceEdited, setPriceEdited] = useState(false)

  useEffect(() => {
    if (!priceEdited) {
      setValue('sale_price', calculatedPrice > 0 ? calculatedPrice.toFixed(2) : '')
    }
  }, [calculatedPrice, priceEdited, setValue])

  async function onSubmit(data: FormValues) {
    const { client_name, address, date, status, sale_price, notes, items } = data
    if (isEdit && id) {
      await updateOrder.mutateAsync({ id, client_name, address, date, status, sale_price, notes, items })
    } else {
      await createOrder.mutateAsync({ client_name, address, date, status, sale_price, notes, items })
    }
    navigate(`/pedidos?date=${data.date}`)
  }

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">{isEdit ? 'Editar pedido' : 'Nuevo pedido'}</h1>
      </div>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <form onSubmit={(handleSubmit as any)(onSubmit)} className="space-y-4">
        <div>
          <Label>Nombre del cliente *</Label>
          <Input {...register('client_name')} placeholder="María González" />
          {errors.client_name && <p className="text-destructive text-xs mt-1">{errors.client_name.message}</p>}
        </div>

        <div>
          <Label>Dirección</Label>
          <Input {...register('address')} placeholder="Opcional" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Fecha</Label>
            <Controller
              control={control}
              name="date"
              render={({ field }) => (
                <DatePicker value={field.value} onChange={field.onChange} />
              )}
            />
          </div>
          <div>
            <Label>Estado</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Budines</Label>
          {fields.map((field, idx) => (
            <div key={field.id} className="flex gap-2 items-center">
              <Controller
                control={control}
                name={`items.${idx}.flavor_id`}
                render={({ field: f }) => (
                  <Select value={f.value} onValueChange={f.onChange}>
                    <SelectTrigger className="flex-1 overflow-hidden">
                      <SelectValue placeholder="Elegí sabor" className="truncate" />
                    </SelectTrigger>
                    <SelectContent>
                      {flavors.map(flavor => (
                        <SelectItem key={flavor.id} value={flavor.id}>
                          {flavor.emoji} {flavor.name} — ${parseFloat(flavor.price_per_budin).toLocaleString('es-AR')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <Input
                type="number"
                min={1}
                className="w-20"
                {...register(`items.${idx}.quantity`)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(idx)}
                disabled={fields.length === 1}
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          ))}
          {errors.items && <p className="text-destructive text-xs">{errors.items.message || (errors.items as any).root?.message}</p>}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ flavor_id: '', quantity: 1 })}
            disabled={watchedItems.some(i => !i.flavor_id)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Agregar sabor
          </Button>
        </div>

        <div>
          <Label>Precio de venta ($)</Label>
          <Input
            type="number"
            step="0.01"
            {...register('sale_price')}
            onChange={e => {
              setPriceEdited(true)
              register('sale_price').onChange(e)
            }}
            placeholder="0.00"
          />
          {calculatedPrice > 0 && !priceEdited && (
            <p className="text-xs text-muted-foreground mt-1">Calculado: ${calculatedPrice.toLocaleString('es-AR')}</p>
          )}
        </div>

        <div>
          <Label>Notas</Label>
          <Input {...register('notes')} placeholder="Opcional" />
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button type="submit" disabled={createOrder.isPending || updateOrder.isPending}>
            {isEdit ? 'Guardar cambios' : 'Crear pedido'}
          </Button>
        </div>
      </form>
    </div>
  )
}
