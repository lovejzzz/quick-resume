"use client";

import { useEffect } from "react";
import { assetPath, basePath } from "../lib/asset-path";

/**
 * Registers the offline worker. The editor has no backend, so once the shell is
 * cached the whole product keeps working with no network at all.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker
        .register(assetPath("/sw.js"), {
          scope: `${basePath}/`,
          // Always revalidate the worker script and anything it imports.
          // Otherwise an older offline shell can survive a new deployment.
          updateViaCache: "none",
        })
        .then((registration) => registration.update())
        .catch(() => {
          // Offline support is an enhancement; failing to register is not fatal.
        });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
