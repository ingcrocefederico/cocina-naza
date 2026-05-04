import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../lib/api'
import type { CommonRecipeItem } from '../types'

export function useCommonRecipe() {
  return useQuery<CommonRecipeItem[]>({
    queryKey: ['common-recipe'],
    queryFn: async () => (await api.get('/api/common-recipe')).data,
  })
}

export function useSaveCommonRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (items: { ingredient_id: string; quantity_per_budin: number; applies_to: 'all' | 'integral' }[]) =>
      api.put('/api/common-recipe', items),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['common-recipe'] })
      qc.invalidateQueries({ queryKey: ['flavors'] })
      qc.invalidateQueries({ queryKey: ['flavor-recipe'] })
      toast.success('Ingredientes comunes guardados')
    },
    onError: () => toast.error('Error al guardar los ingredientes comunes'),
  })
}
