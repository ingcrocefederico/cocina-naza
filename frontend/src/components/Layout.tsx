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
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-4">
        <span className="font-semibold text-slate-800 text-lg">🍞 Cocina Naza</span>
        <nav className="flex gap-1 flex-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          {user?.name}
          <Button variant="ghost" size="sm" onClick={() => { logout(undefined); navigate('/login') }}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>
      <main className="p-6 max-w-5xl mx-auto">
        <Outlet />
      </main>
    </div>
  )
}
