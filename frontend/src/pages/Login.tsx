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
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6 px-8">
        <div
          className="text-7xl font-bold text-primary leading-none"
          style={{ fontFamily: "'Amatic SC', cursive" }}
        >
          Cocina Naza
        </div>
        <p className="text-muted-foreground text-sm tracking-wider uppercase">
          Gestión de pedidos
        </p>
        <Button
          size="lg"
          className="w-full max-w-xs cursor-pointer"
          onClick={() => { window.location.href = '/api/auth/google' }}
        >
          Entrar con Google
        </Button>
      </div>
    </div>
  )
}
