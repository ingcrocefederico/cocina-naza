import { useEffect, useState } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Share, X } from 'lucide-react'
import { onInstallPromptReady, triggerInstall } from '@/lib/pwaInstall'

const DISMISSED_KEY = 'pwa-install-dismissed'

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream
}

export default function PWAInstallPrompt() {
  const [open, setOpen] = useState(false)
  const ios = isIOS()

  useEffect(() => {
    if (isStandalone()) return
    if (sessionStorage.getItem(DISMISSED_KEY)) return

    if (ios) {
      const timer = setTimeout(() => setOpen(true), 1500)
      return () => clearTimeout(timer)
    }

    // Chrome/Android: event may have already fired before component mounted
    const unsub = onInstallPromptReady(() => setOpen(true))
    return unsub
  }, [ios])

  function dismiss() {
    sessionStorage.setItem(DISMISSED_KEY, '1')
    setOpen(false)
  }

  async function install() {
    const outcome = await triggerInstall()
    if (outcome === 'accepted') sessionStorage.setItem(DISMISSED_KEY, '1')
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) dismiss() }}>
      <SheetContent side="bottom" className="flex flex-col gap-0 p-0 rounded-t-2xl">
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-muted-foreground/25 shrink-0" />

        <button
          type="button"
          onClick={dismiss}
          className="absolute top-4 right-4 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-6 pt-5 pb-8 flex flex-col items-center gap-4 text-center">
          <img
            src="/pwa-192x192.png"
            alt="Cocina Naza"
            className="w-20 h-20 rounded-2xl shadow-lg"
          />

          <div className="space-y-1">
            <p className="font-bold text-foreground text-lg" style={{ fontFamily: "'Amatic SC', cursive" }}>
              Cocina Naza
            </p>
            <p className="text-sm text-muted-foreground">
              Instalá la app para acceder más rápido desde tu pantalla de inicio.
            </p>
          </div>

          {ios ? (
            <div className="w-full rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground flex flex-col gap-1.5">
              <p className="font-medium text-foreground">Cómo instalar en iOS:</p>
              <p className="flex items-center justify-center gap-1.5">
                Tocá <Share className="w-4 h-4 inline shrink-0" /> Compartir
                → <strong className="text-foreground">Agregar a inicio</strong>
              </p>
            </div>
          ) : (
            <Button className="w-full" onClick={install}>
              Instalar app
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
