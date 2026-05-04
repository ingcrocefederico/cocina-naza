export type OrderStatus = 'pedido' | 'preparado' | 'entregado' | 'cobrado' | 'cobrado_efectivo' | 'cobrado_transf'
export type Unit = 'kg' | 'g' | 'L' | 'ml' | 'unidad'

export interface User {
  id: string
  email: string
  name: string
  avatar_url: string | null
}

export interface Flavor {
  id: string
  name: string
  emoji: string
  price_per_budin: string
  active: boolean
  cost_per_budin: string
  profit_per_budin: string
  preparation: string | null
  uses_common_ingredients: boolean
}

export interface Ingredient {
  id: string
  name: string
  unit: Unit
  price_per_unit: string
}

export interface OrderItem {
  flavor_id: string
  flavor_name: string
  flavor_emoji: string
  quantity: number
  price_per_budin: string
}

export interface Order {
  id: string
  client_name: string
  client_id: string | null
  address: string | null
  date: string
  status: OrderStatus
  sale_price: string | null
  notes: string | null
  items: OrderItem[]
}

export interface RecipeItem {
  id: string | null
  ingredient_id: string
  ingredient_name: string
  unit: Unit
  quantity_per_budin: number
  price_per_unit: string
  is_common: boolean
  is_overridden: boolean
}

export interface CommonRecipeItem {
  id: string
  ingredient_id: string
  ingredient_name: string
  unit: Unit
  quantity_per_budin: number
  price_per_unit: string
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

export interface CalculatorResult {
  totals: {
    id: string
    name: string
    unit: Unit
    totalQuantity: number
    pricePerUnit: number
    totalCost: number
  }[]
  byFlavor: {
    flavorId: string
    flavorName: string
    budinCount: number
    ingredients: { id: string; name: string; unit: Unit; totalQuantity: number }[]
  }[]
  financials: {
    totalCost: number
    totalSales: number
    profit: number
  }
}
