import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../lib/api'
import type { User } from '../types'

export function useAuth() {
  const qc = useQueryClient()

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        const res = await api.get<User>('/api/auth/me')
        return res.data
      } catch {
        return null
      }
    },
    staleTime: Infinity,
  })

  const logout = useMutation({
    mutationFn: () => api.post('/api/auth/logout'),
    onSuccess: () => {
      qc.setQueryData(['auth', 'me'], null)
    },
    onError: () => toast.error('Error al cerrar sesión'),
  })

  return { user, isLoading, logout: logout.mutate }
}
