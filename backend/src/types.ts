export interface User {
  id: string
  email: string
  name: string
  avatar_url: string | null
  google_id: string
  created_at: string
}

export interface Flavor {
  id: string
  name: string
  emoji: string
  price_per_budin: string
  active: boolean
  created_at: string
  cost_per_budin: string
  profit_per_budin: string
  preparation: string | null
}

export interface Ingredient {
  id: string
  name: string
  unit: 'kg' | 'g' | 'L' | 'ml' | 'unidad'
  price_per_unit: string
  updated_at: string
}

export interface Order {
  id: string
  client_name: string
  address: string | null
  date: string
  status: 'pedido' | 'preparado' | 'entregado' | 'cobrado'
  sale_price: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  flavor_id: string
  quantity: number
}

export interface OrderWithItems extends Order {
  items: (OrderItem & { flavor_name: string; flavor_emoji: string; price_per_budin: string })[]
}
