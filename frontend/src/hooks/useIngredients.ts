import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../lib/api'
import type { Ingredient, CalculatorResult } from '../types'

export function useIngredients() {
  return useQuery<Ingredient[]>({
    queryKey: ['ingredients'],
    queryFn: async () => (await api.get('/api/ingredients')).data,
  })
}

export function useCreateIngredient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Pick<Ingredient, 'name' | 'unit'> & { price_per_unit?: string }) =>
      api.post<Ingredient>('/api/ingredients', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ingredients'] })
      qc.invalidateQueries({ queryKey: ['flavors'] })
      qc.invalidateQueries({ queryKey: ['calculator'] })
      toast.success('Ingrediente creado')
    },
    onError: () => toast.error('Error al crear el ingrediente'),
  })
}

export function useUpdateIngredient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Ingredient> & { id: string }) =>
      api.put(`/api/ingredients/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ingredients'] })
      qc.invalidateQueries({ queryKey: ['flavors'] })
      qc.invalidateQueries({ queryKey: ['calculator'] })
      toast.success('Ingrediente actualizado')
    },
    onError: () => toast.error('Error al actualizar el ingrediente'),
  })
}

export function useDeleteIngredient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/ingredients/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ingredients'] })
      qc.invalidateQueries({ queryKey: ['flavors'] })
      qc.invalidateQueries({ queryKey: ['calculator'] })
      toast.success('Ingrediente eliminado')
    },
    onError: () => toast.error('Error al eliminar el ingrediente'),
  })
}

export function useCalculator(date: string) {
  return useQuery<CalculatorResult>({
    queryKey: ['calculator', date],
    queryFn: async () => (await api.get(`/api/ingredients/calculator?date=${date}`)).data,
    enabled: !!date,
  })
}
