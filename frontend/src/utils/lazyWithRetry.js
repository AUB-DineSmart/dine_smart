import { lazy } from "react";

const moduleCache = new Map();

const DEFAULT_RETRIES = 3;
const DEFAULT_DELAY_MS = 250;

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function isDynamicImportError(error) {
  const message = String(error?.message || error || "");
  const name = String(error?.name || "");

  return (
    name === "ChunkLoadError" ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /Loading chunk \d+ failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message)
  );
}

function loadModule(importer, cacheKey, options = {}) {
  const cached = moduleCache.get(cacheKey);

  if (cached?.status === "fulfilled") {
    return Promise.resolve(cached.module);
  }

  if (cached?.status === "pending") {
    return cached.promise;
  }

  const retries = options.retries ?? DEFAULT_RETRIES;
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;

  const promise = (async () => {
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const loadedModule = await importer();
        moduleCache.set(cacheKey, { status: "fulfilled", module: loadedModule });
        return loadedModule;
      } catch (error) {
        lastError = error;

        if (!isDynamicImportError(error) || attempt === retries) {
          moduleCache.delete(cacheKey);
          throw error;
        }

        await wait(delayMs * (attempt + 1));
      }
    }

    moduleCache.delete(cacheKey);
    throw lastError;
  })();

  moduleCache.set(cacheKey, { status: "pending", promise });
  return promise;
}

export function lazyWithRetry(importer, cacheKey, options) {
  return lazy(() => loadModule(importer, cacheKey, options));
}

export function preloadLazy(importer, cacheKey, options) {
  return loadModule(importer, cacheKey, options).catch(() => null);
}
