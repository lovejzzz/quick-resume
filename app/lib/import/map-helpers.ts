/**
 * Polyfills `Map.prototype.getOrInsert` / `getOrInsertComputed`.
 *
 * pdf.js v5 calls these on every render and operator-list path. They are a
 * TC39 proposal ("upsert") that has not reached every shipping browser, so on
 * an engine without them `page.render()` throws
 * `getOrInsertComputed is not a function` while plain text extraction — which
 * never touches that code — keeps working. That asymmetry makes it look like a
 * broken PDF rather than a missing method.
 *
 * Semantics follow the proposal: return the existing value if the key is
 * present, otherwise insert the given (or computed) value and return it.
 */

type Upsertable = {
  getOrInsert?: unknown;
  getOrInsertComputed?: unknown;
  get(key: unknown): unknown;
  set(key: unknown, value: unknown): unknown;
  has(key: unknown): boolean;
};

function install(prototype: Upsertable | undefined) {
  if (!prototype) return;

  if (typeof prototype.getOrInsert !== "function") {
    Object.defineProperty(prototype, "getOrInsert", {
      configurable: true,
      writable: true,
      value: function getOrInsert(this: Upsertable, key: unknown, value: unknown) {
        if (this.has(key)) return this.get(key);
        this.set(key, value);
        return value;
      },
    });
  }

  if (typeof prototype.getOrInsertComputed !== "function") {
    Object.defineProperty(prototype, "getOrInsertComputed", {
      configurable: true,
      writable: true,
      value: function getOrInsertComputed(
        this: Upsertable,
        key: unknown,
        callback: (key: unknown) => unknown,
      ) {
        if (this.has(key)) return this.get(key);
        const value = callback(key);
        this.set(key, value);
        return value;
      },
    });
  }
}

let installed = false;

/** Idempotent; safe to call before every pdf.js entry point. */
export function ensureMapHelpers() {
  if (installed) return;
  installed = true;
  install(Map.prototype as unknown as Upsertable);
  install(WeakMap.prototype as unknown as Upsertable);
}
