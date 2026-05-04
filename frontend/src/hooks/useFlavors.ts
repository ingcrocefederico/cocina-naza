import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../lib/api'
import type { Flavor, RecipeItem } from '../types'

export function useFlavors() {
  return useQuery<Flavor[]>({
    queryKey: ['flavors'],
    queryFn: async () => (await api.get('/api/flavors')).data,
  })
}

export function useCreateFlavor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Flavor>) => api.post<Flavor>('/api/flavors', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flavors'] })
      toast.success('Sabor creado')
    },
    onError: () => toast.error('Error al crear el sabor'),
  })
}

export function useUpdateFlavor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Flavor> & { id: string }) =>
      api.put(`/api/flavors/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flavors'] })
      toast.success('Sabor actualizado')
    },
    onError: () => toast.error('Error al actualizar el sabor'),
  })
}

export function useDeleteFlavor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/flavors/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flavors'] })
      toast.success('Sabor eliminado')
    },
    onError: () => toast.error('Error al eliminar el sabor'),
  })
}

export function useFlavorRecipe(id: string | null) {
  return useQuery<RecipeItem[]>({
    queryKey: ['flavor-recipe', id],
    queryFn: async () => (await api.get(`/api/flavors/${id}/recipe`)).data,
    enabled: !!id,
  })
}

export function useSaveFlavorRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, items }: { id: string; items: { ingredient_id: string; quantity_per_budin: number }[] }) =>
      api.put(`/api/flavors/${id}/recipe`, items),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['flavor-recipe', id] })
      qc.invalidateQueries({ queryKey: ['flavors'] })
      toast.success('Receta guardada')
    },
    onError: () => toast.error('Error al guardar la receta'),
  })
}
