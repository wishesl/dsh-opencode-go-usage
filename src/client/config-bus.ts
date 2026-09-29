/**
 * In-bundle change bus.
 *
 * The settings page writes the configuration; the composer chip reads it. They
 * are two components of one client bundle, so a module-level subscriber list is
 * all that is needed to let a write take effect on the chip immediately instead
 * of on its next poll. Nothing here crosses a bundle boundary — a second copy of
 * this plugin would simply not see the notification.
 * @module dsh-ocgo-usage/client/config-bus
 */

/** Listeners waiting for a config write made through this bundle. */
const listeners = new Set<() => void>()

/**
 * Subscribe to configuration writes made through this bundle.
 * @param listener - called after a successful write.
 * @returns the disposer.
 */
export function onConfigChanged(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Announce a successful configuration write.
 *
 * A misbehaving listener must never fail the write that triggered it, so every
 * listener is isolated; the snapshot also keeps a listener that unsubscribes
 * during notification from perturbing the walk.
 */
export function notifyConfigChanged(): void {
  for (const listener of [...listeners]) {
    try {
      listener()
    } catch {
      // Ignore: the write already succeeded and is durable.
    }
  }
}
