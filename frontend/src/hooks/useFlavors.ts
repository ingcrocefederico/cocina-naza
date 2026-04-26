import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type { Flavor } from '../types'

export function useFlavors() {
  return useQuery<Flavor[]>({
    queryKey: ['flavors'],
    queryFn: async () => (await api.get('/api/flavors')).data,
  })
}

export function useCreateFlavor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Flavor>) => api.post('/api/flavors', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flavors'] }),
  })
}

export function useUpdateFlavor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Flavor> & { id: string }) =>
      api.put(`/api/flavors/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flavors'] }),
  })
}

export function useDeleteFlavor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/flavors/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flavors'] }),
  })
}
