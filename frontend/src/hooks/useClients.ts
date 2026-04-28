import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type { Client, ClientWithStats } from '../types'

export interface CreateClientInput {
  name: string
  address?: string
  phone?: string
  notes?: string
}

export interface UpdateClientInput {
  id: string
  name?: string
  address?: string
  phone?: string
  notes?: string
}

export function useClients() {
  return useQuery<ClientWithStats[]>({
    queryKey: ['clients'],
    queryFn: async () => (await api.get('/api/clients')).data,
  })
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateClientInput) => api.post<Client>('/api/clients', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useUpdateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateClientInput) =>
      api.put<Client>(`/api/clients/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useDeleteClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/clients/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
