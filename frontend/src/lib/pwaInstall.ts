interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let _deferred: BeforeInstallPromptEvent | null = null
const _listeners: Array<(e: BeforeInstallPromptEvent) => void> = []

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  _deferred = e as BeforeInstallPromptEvent
  _listeners.forEach(fn => fn(_deferred!))
})

export function onInstallPromptReady(fn: (e: BeforeInstallPromptEvent) => void) {
  if (_deferred) {
    fn(_deferred)
  } else {
    _listeners.push(fn)
  }
  return () => {
    const idx = _listeners.indexOf(fn)
    if (idx !== -1) _listeners.splice(idx, 1)
  }
}

export async function triggerInstall(): Promise<'accepted' | 'dismissed' | null> {
  if (!_deferred) return null
  await _deferred.prompt()
  const { outcome } = await _deferred.userChoice
  _deferred = null
  return outcome
}
