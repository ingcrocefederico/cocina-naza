import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type { Order, OrderStatus, CalculatorResult } from '../types'

export type OrderItemInput = { flavor_id: string; quantity: number }

export interface CreateOrderInput {
  client_name: string
  address?: string
  date?: string
  status?: OrderStatus
  sale_price?: string
  notes?: string
  items: OrderItemInput[]
}

export interface UpdateOrderInput {
  id: string
  client_name?: string
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
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ['orders', vars.date] }),
  })
}

export function useUpdateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateOrderInput) =>
      api.put<Order>(`/api/orders/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  })
}

export function useDeleteOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/orders/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  })
}
