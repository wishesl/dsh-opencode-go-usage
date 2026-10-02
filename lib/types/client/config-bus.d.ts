/**
 * In-bundle change bus.
 *
 * The settings page writes the configuration; the composer chip reads it. They
 * are two components of one client bundle, so a module-level subscriber list is
 * all that is needed to let a write take effect on the chip immediately instead
 * of on its next poll. Nothing here crosses a bundle boundary — a second copy of
 * this plugin would simply not see the notification.
 * @module @sutong12/dsh-opencode-go-usage/client/config-bus
 */
/**
 * Subscribe to configuration writes made through this bundle.
 * @param listener - called after a successful write.
 * @returns the disposer.
 */
export declare function onConfigChanged(listener: () => void): () => void;
/**
 * Announce a successful configuration write.
 *
 * A misbehaving listener must never fail the write that triggered it, so every
 * listener is isolated; the snapshot also keeps a listener that unsubscribes
 * during notification from perturbing the walk.
 */
export declare function notifyConfigChanged(): void;
//# sourceMappingURL=config-bus.d.ts.map