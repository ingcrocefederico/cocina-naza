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
  uses_common_ingredients: boolean
}

export interface Ingredient {
  id: string
  name: string
  unit: 'kg' | 'g' | 'L' | 'ml' | 'unidad'
  price_per_unit: string
  updated_at: string
}

export interface CommonRecipeItem {
  id: string
  ingredient_id: string
  ingredient_name: string
  unit: string
  quantity_per_budin: number
  price_per_unit: string
  applies_to: 'all' | 'integral'
}

export interface Order {
  id: string
  client_name: string
  client_id: string | null
  address: string | null
  date: string
  status: 'pedido' | 'preparado' | 'entregado' | 'cobrado' | 'cobrado_efectivo' | 'cobrado_transf'
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

export interface Client {
  id: string
  name: string
  address: string | null
  phone: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface BudinByFlavor {
  flavor_name: string
  emoji: string
  quantity: number
}

export interface ClientWithStats extends Client {
  debt: number
  total_budines: number
  budines_by_flavor: BudinByFlavor[]
  estado: 'deudor' | 'al_dia'
}
