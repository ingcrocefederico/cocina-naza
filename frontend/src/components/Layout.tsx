import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Button } from '@/components/ui/button'
import { ShoppingBag, Palette, FlaskConical, LogOut } from 'lucide-react'

const navItems = [
  { to: '/pedidos', label: 'Pedidos', icon: ShoppingBag },
  { to: '/sabores', label: 'Sabores', icon: Palette },
  { to: '/ingredientes', label: 'Ingredientes', icon: FlaskConical },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="h-dvh bg-background flex flex-col overflow-hidden">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between shrink-0 z-40">
        <span
          className="font-bold text-primary text-2xl tracking-wide"
          style={{ fontFamily: "'Amatic SC', cursive" }}
        >
          Cocina Naza
        </span>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="max-w-[140px] truncate">{user?.name}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { logout(undefined); navigate('/login') }}
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-24 md:px-6 md:pt-6 max-w-5xl mx-auto w-full">
        <Outlet />
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex max-w-5xl mx-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 py-3 flex-1 text-xs font-medium transition-colors min-h-[56px] ${
                  isActive
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
