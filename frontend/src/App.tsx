import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Login from './pages/Login'
import Sabores from './pages/Sabores'
import Pedidos from './pages/Pedidos'
import PedidoForm from './pages/PedidoForm'
import Ingredientes from './pages/Ingredientes'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <ProtectedRoute><Layout /></ProtectedRoute>,
    children: [
      { path: '/sabores', element: <Sabores /> },
      { path: '/pedidos', element: <Pedidos /> },
      { path: '/pedidos/nuevo', element: <PedidoForm /> },
      { path: '/pedidos/:id', element: <PedidoForm /> },
      { path: '/ingredientes', element: <Ingredientes /> },
      { path: '/', element: <Pedidos /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
