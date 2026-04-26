import { useState } from 'react'
import { format } from 'date-fns'
import { useSearchParams } from 'react-router-dom'
import { useIngredients, useUpdateIngredient, useCalculator } from '../hooks/useIngredients'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Ingredient } from '../types'

export default function Ingredientes() {
  const [params, setParams] = useSearchParams()
  const today = format(new Date(), 'yyyy-MM-dd')
  const date = params.get('date') || today

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">Ingredientes</h1>
      <Tabs defaultValue="calculadora">
        <TabsList>
          <TabsTrigger value="calculadora">Calculadora</TabsTrigger>
          <TabsTrigger value="precios">Precios</TabsTrigger>
        </TabsList>
        <TabsContent value="calculadora" className="mt-4">
          <CalculadoraTab date={date} onDateChange={d => setParams({ date: d })} />
        </TabsContent>
        <TabsContent value="precios" className="mt-4">
          <PreciosTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function CalculadoraTab({ date, onDateChange }: { date: string; onDateChange: (d: string) => void }) {
  const { data, isLoading } = useCalculator(date)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Fecha:</span>
        <Input type="date" value={date} onChange={e => onDateChange(e.target.value)} className="w-40" />
      </div>

      {isLoading && <div className="text-muted-foreground">Calculando...</div>}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Costo total', value: data.financials.totalCost, color: 'text-red-400' },
              { label: 'Venta total', value: data.financials.totalSales, color: 'text-sky-400' },
              { label: 'Ganancia', value: data.financials.profit, color: data.financials.profit >= 0 ? 'text-emerald-400' : 'text-red-400' },
            ].map(({ label, value, color }) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`text-lg font-bold ${color}`}>
                    ${value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {data.totals.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Total ingredientes</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ingrediente</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Costo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.totals.map(t => (
                      <TableRow key={t.id}>
                        <TableCell>{t.name}</TableCell>
                        <TableCell>{t.totalQuantity.toLocaleString('es-AR')} {t.unit}</TableCell>
                        <TableCell className="text-muted-foreground">
                          ${t.totalCost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {data.byFlavor.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Desglose por sabor</h2>
              {data.byFlavor.map(flavor => (
                <Card key={flavor.flavorId}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {flavor.flavorName} <span className="font-normal text-muted-foreground">×{flavor.budinCount}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableBody>
                        {flavor.ingredients.map(ing => (
                          <TableRow key={ing.id}>
                            <TableCell className="text-sm">{ing.name}</TableCell>
                            <TableCell className="text-sm">{ing.totalQuantity.toLocaleString('es-AR')} {ing.unit}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {data.totals.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Sin datos para esta fecha. Asegurate de tener recetas cargadas.
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PreciosTab() {
  const { data: ingredients = [], isLoading } = useIngredients()
  const updateIngredient = useUpdateIngredient()
  const [prices, setPrices] = useState<Record<string, string>>({})

  function handleSave(ingredient: Ingredient) {
    const newPrice = prices[ingredient.id]
    if (!newPrice) return
    updateIngredient.mutate({ id: ingredient.id, price_per_unit: newPrice as unknown as string })
  }

  if (isLoading) return <div className="text-muted-foreground">Cargando...</div>

  if (ingredients.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">Sin ingredientes cargados. Se cargan desde las recetas.</div>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ingrediente</TableHead>
          <TableHead>Unidad</TableHead>
          <TableHead>Precio por unidad ($)</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ingredients.map(ing => (
          <TableRow key={ing.id}>
            <TableCell>{ing.name}</TableCell>
            <TableCell>{ing.unit}</TableCell>
            <TableCell>
              <Input
                type="number"
                step="0.01"
                defaultValue={ing.price_per_unit}
                className="w-32"
                onChange={e => setPrices(p => ({ ...p, [ing.id]: e.target.value }))}
              />
            </TableCell>
            <TableCell>
              <Button size="sm" variant="outline" onClick={() => handleSave(ing)}>
                Guardar
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
