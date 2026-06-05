import { useRouteError, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function RouteError() {
  const error = useRouteError()
  const navigate = useNavigate()

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error('Route error:', error)
  }

  return (
    <div className="h-dvh bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-5xl">🍰</span>
      <h1 className="text-xl font-semibold text-foreground">Algo salió mal</h1>
      <p className="text-sm text-muted-foreground max-w-xs">
        Ocurrió un error inesperado. Probá recargar; si sigue, volvé a Pedidos.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => window.location.reload()}>
          Recargar
        </Button>
        <Button onClick={() => navigate('/pedidos', { replace: true })}>
          Ir a Pedidos
        </Button>
      </div>
    </div>
  )
}
