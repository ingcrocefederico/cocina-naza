import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../lib/api'
import type { Order, OrderStatus, CalculatorResult } from '../types'

export type OrderItemInput = { flavor_id: string; quantity: number }

export interface CreateOrderInput {
  client_id: string
  address?: string
  date?: string
  status?: OrderStatus
  sale_price?: string
  notes?: string
  items: OrderItemInput[]
}

export interface UpdateOrderInput {
  id: string
  client_id?: string
  address?: string
  date?: string
  status?: OrderStatus
  sale_price?: string
  notes?: string
  items?: OrderItemInput[]
}

export function useOrders(date: string) {
  return useQuery<Order[]>({
    queryKey: ['orders', date],
    queryFn: async () => (await api.get(`/api/orders?date=${date}`)).data,
    enabled: !!date,
  })
}

export function useLatestOrderDate() {
  return useQuery<{ date: string | null }>({
    queryKey: ['orders', 'latest-date'],
    queryFn: async () => (await api.get('/api/orders/latest-date')).data,
  })
}

export function useClientOrders(clientId: string | null) {
  return useQuery<Order[]>({
    queryKey: ['orders', 'client', clientId],
    queryFn: async () => (await api.get(`/api/orders/by-client/${clientId}`)).data,
    enabled: !!clientId,
  })
}

export function useOrderCounts(month: string) {
  return useQuery<Record<string, number>>({
    queryKey: ['order-counts', month],
    queryFn: async () => (await api.get(`/api/orders/counts?month=${month}`)).data,
    enabled: !!month,
  })
}

export function useCalculator(date: string) {
  return useQuery<CalculatorResult>({
    queryKey: ['calculator', date],
    queryFn: async () => (await api.get(`/api/ingredients/calculator?date=${date}`)).data,
    enabled: !!date,
  })
}

export function useCreateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateOrderInput) => api.post<Order>('/api/orders', data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['orders', vars.date] })
      qc.invalidateQueries({ queryKey: ['order-counts'] })
      toast.success('Pedido creado')
    },
    onError: () => toast.error('Error al crear el pedido'),
  })
}

export function useUpdateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateOrderInput) =>
      api.put<Order>(`/api/orders/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['order-counts'] })
      toast.success('Pedido actualizado')
    },
    onError: () => toast.error('Error al actualizar el pedido'),
  })
}

export function useDeleteOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/orders/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['order-counts'] })
      toast.success('Pedido eliminado')
    },
    onError: () => toast.error('Error al eliminar el pedido'),
  })
}
