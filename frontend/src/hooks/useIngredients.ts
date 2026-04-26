import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import type { Ingredient, CalculatorResult } from '../types'

export function useIngredients() {
  return useQuery<Ingredient[]>({
    queryKey: ['ingredients'],
    queryFn: async () => (await api.get('/api/ingredients')).data,
  })
}

export function useUpdateIngredient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Ingredient> & { id: string }) =>
      api.put(`/api/ingredients/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingredients'] }),
  })
}

export function useCalculator(date: string) {
  return useQuery<CalculatorResult>({
    queryKey: ['calculator', date],
    queryFn: async () => (await api.get(`/api/ingredients/calculator?date=${date}`)).data,
    enabled: !!date,
  })
}
