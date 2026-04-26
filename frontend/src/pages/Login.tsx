import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Button } from '@/components/ui/button'

export default function Login() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/pedidos', { replace: true })
  }, [user, navigate])

  if (isLoading) return null

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="text-center space-y-6">
        <div className="text-5xl">🍞</div>
        <h1 className="text-2xl font-bold text-slate-800">Cocina Naza</h1>
        <p className="text-slate-500">Gestión de pedidos</p>
        <Button
          size="lg"
          onClick={() => { window.location.href = '/api/auth/google' }}
        >
          Entrar con Google
        </Button>
      </div>
    </div>
  )
}
