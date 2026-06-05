import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import Login from './pages/Login'
import Sabores from './pages/Sabores'
import Pedidos from './pages/Pedidos'
import PedidoForm from './pages/PedidoForm'
import Ingredientes from './pages/Ingredientes'
import Clientes from './pages/Clientes'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import RouteError from './components/RouteError'

const router = createBrowserRouter([
  { path: '/login', element: <Login />, errorElement: <RouteError /> },
  {
    element: <ProtectedRoute><Layout /></ProtectedRoute>,
    errorElement: <RouteError />,
    children: [
      { path: '/sabores', element: <Sabores /> },
      { path: '/pedidos', element: <Pedidos /> },
      { path: '/pedidos/nuevo', element: <PedidoForm /> },
      { path: '/pedidos/:id', element: <PedidoForm /> },
      { path: '/ingredientes', element: <Ingredientes /> },
      { path: '/clientes', element: <Clientes /> },
      { path: '/', element: <Pedidos /> },
      // Cualquier URL desconocida: redirige a Pedidos en vez del 404 de React Router
      { path: '*', element: <Navigate to="/pedidos" replace /> },
    ],
  },
])

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="bottom-center" richColors closeButton />
    </>
  )
}
