import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { useFlavors } from '../hooks/useFlavors'
import { useCreateOrder, useUpdateOrder, useOrders, useLatestOrderDate } from '../hooks/useOrders'
import { useClients } from '../hooks/useClients'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectSheet } from '@/components/ui/select-sheet'
import { DatePicker } from '@/components/ui/date-picker'
import { Trash2, Plus, ArrowLeft } from 'lucide-react'
import ClientSheet from '../components/ClientSheet'
import type { OrderStatus, Client } from '../types'

const itemSchema = z.object({
  flavor_id: z.string().min(1, 'Elegí un sabor'),
  quantity: z.coerce.number().int().min(1),
})

const schema = z.object({
  client_id: z.string().min(1, 'Seleccioná un cliente'),
  address: z.string().optional(),
  date: z.string().min(1),
  status: z.enum(['pedido', 'preparado', 'entregado', 'cobrado', 'cobrado_efectivo', 'cobrado_transf']),
  sale_price: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, 'Agregá al menos un budín'),
})

type FormValues = {
  client_id: string
  address?: string
  date: string
  status: 'pedido' | 'preparado' | 'entregado' | 'cobrado' | 'cobrado_efectivo' | 'cobrado_transf'
  sale_price?: string
  notes?: string
  items: { flavor_id: string; quantity: number }[]
}

const STATUSES: { value: OrderStatus; label: string }[] = [
  { value: 'pedido',           label: 'Pedido' },
  { value: 'preparado',        label: 'Preparado' },
  { value: 'entregado',        label: 'Entregado' },
  { value: 'cobrado_efectivo', label: 'Cob. Efectivo' },
  { value: 'cobrado_transf',   label: 'Cob. Transf.' },
]

export default function PedidoForm() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isEdit = !!id

  const dateFromParams = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd')
  const { data: flavors = [] } = useFlavors()
  const { data: orders = [] } = useOrders(dateFromParams)
  const { data: latestDateData } = useLatestOrderDate()
  const createOrder = useCreateOrder()
  const updateOrder = useUpdateOrder()
  const { data: clients = [] } = useClients()
  const [clientSheetOpen, setClientSheetOpen] = useState(false)

  const existingOrder = useMemo(() => orders.find(o => o.id === id), [orders, id])

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      client_id: '',
      address: '',
      date: dateFromParams,
      status: 'pedido',
      sale_price: '',
      notes: '',
      items: [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = useWatch({ control, name: 'items' })

  const [flavorTypes, setFlavorTypes] = useState<('común' | 'integral')[]>([])

  function appendFlavor(type: 'común' | 'integral') {
    append({ flavor_id: '', quantity: 1 })
    setFlavorTypes(prev => [...prev, type])
  }

  function removeItem(idx: number) {
    remove(idx)
    setFlavorTypes(prev => prev.filter((_, i) => i !== idx))
  }

  useEffect(() => {
    if (!isEdit && latestDateData?.date) {
      setValue('date', latestDateData.date)
    }
  }, [latestDateData, isEdit, setValue])

  useEffect(() => {
    if (existingOrder && flavors.length > 0) {
      if (existingOrder.client_id) setValue('client_id', existingOrder.client_id)
      setValue('address', existingOrder.address || '')
      setValue('date', existingOrder.date)
      setValue('status', existingOrder.status)
      setValue('sale_price', existingOrder.sale_price || '')
      setValue('notes', existingOrder.notes || '')
      setValue('items', existingOrder.items.map(i => ({ flavor_id: i.flavor_id, quantity: i.quantity })))
      setFlavorTypes(existingOrder.items.map(i => {
        const flavor = flavors.find(f => f.id === i.flavor_id)
        return flavor?.name.startsWith('(Int)') ? 'integral' : 'común'
      }))
    }
  }, [existingOrder, setValue, flavors])

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
    const { client_id, address, date, status, sale_price, notes, items } = data
    if (isEdit && id) {
      await updateOrder.mutateAsync({ id, client_id, address, date, status, sale_price, notes, items })
    } else {
      await createOrder.mutateAsync({ client_id, address, date, status, sale_price, notes, items })
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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label>Cliente *</Label>
          <Controller
            control={control}
            name="client_id"
            render={({ field }) => (
              <SelectSheet
                value={field.value}
                onValueChange={(val) => {
                  field.onChange(val)
                  const client = clients.find(c => c.id === val)
                  if (client?.address) setValue('address', client.address)
                }}
                options={clients.map(c => ({
                  value: c.id,
                  label: c.name,
                  sublabel: c.phone ?? undefined,
                }))}
                placeholder="Seleccioná un cliente"
                title="Cliente"
                searchable
                onCreate={() => setClientSheetOpen(true)}
                createLabel="Nuevo cliente..."
              />
            )}
          />
          {errors.client_id && <p className="text-destructive text-xs mt-1">{errors.client_id.message}</p>}
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
                <SelectSheet
                  value={field.value}
                  onValueChange={field.onChange}
                  options={STATUSES.map(s => ({ value: s.value, label: s.label }))}
                  title="Estado"
                />
              )}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Budines</Label>
          {fields.map((field, idx) => {
            const type = flavorTypes[idx] ?? 'común'
            const filteredFlavors = flavors.filter(f =>
              type === 'integral' ? f.name.startsWith('(Int)') : !f.name.startsWith('(Int)')
            )
            return (
              <div key={field.id} className="flex gap-2 items-center">
                <Controller
                  control={control}
                  name={`items.${idx}.flavor_id`}
                  render={({ field: f }) => (
                    <SelectSheet
                      value={f.value}
                      onValueChange={f.onChange}
                      options={filteredFlavors.map(flavor => ({
                        value: flavor.id,
                        label: `${flavor.emoji} ${flavor.name}`,
                        sublabel: `$${parseFloat(flavor.price_per_budin).toLocaleString('es-AR')}`,
                      }))}
                      placeholder={`Elegí sabor ${type}`}
                      title={`Sabor ${type}`}
                      searchable
                      className="flex-1 overflow-hidden"
                    />
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
                  onClick={() => removeItem(idx)}
                  disabled={fields.length === 1}
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            )
          })}
          {errors.items && <p className="text-destructive text-xs">{errors.items.message || (errors.items as any).root?.message}</p>}
          <div className="flex gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => appendFlavor('común')}
              disabled={watchedItems.some(i => !i.flavor_id)}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Agregar Sabor común
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => appendFlavor('integral')}
              disabled={watchedItems.some(i => !i.flavor_id)}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Agregar Sabor integral
            </Button>
          </div>
        </div>

        <div>
          <Label>Precio de venta ($)</Label>
          <Input
            type="text"
            inputMode="numeric"
            value={
              watch('sale_price')
                ? parseFloat(watch('sale_price') || '0').toLocaleString('es-AR', { maximumFractionDigits: 0 })
                : ''
            }
            onChange={e => {
              setPriceEdited(true)
              const raw = e.target.value.replace(/[^0-9]/g, '')
              setValue('sale_price', raw)
            }}
            placeholder="0"
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

      <ClientSheet
        open={clientSheetOpen}
        onOpenChange={setClientSheetOpen}
        onSuccess={(client: Client) => {
          setValue('client_id', client.id)
          if (client.address) setValue('address', client.address)
        }}
      />
    </div>
  )
}
