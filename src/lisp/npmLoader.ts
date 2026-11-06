/**
 * OmniLisp NPM Package Bridge
 * Enables dynamic loading and evaluation of NPM packages in OmniLisp.
 * Loads modern ESM modules from esm.sh CDN with offline fallbacks for popular libraries.
 */

import { Env, LispJsFunction, LispValue } from './types';

export interface NpmPackageInfo {
  name: string;
  version?: string;
  description: string;
  category: 'utility' | 'date' | 'math' | 'fx' | 'functional';
  suggestedAlias: string;
  popularExports: string[];
  sampleCode: string;
}

export const POPULAR_NPM_PACKAGES: NpmPackageInfo[] = [
  {
    name: 'lodash',
    description: 'A modern JavaScript utility library delivering modularity, performance & extras.',
    category: 'utility',
    suggestedAlias: '_',
    popularExports: ['chunk', 'compact', 'flatten', 'shuffle', 'capitalize', 'kebabCase', 'reverse', 'uniq'],
    sampleCode: `(import-npm "lodash" :as _)
(print "Lodash chunk:" (_/chunk (list 1 2 3 4 5 6) 2))
(print "Lodash shuffle:" (_/shuffle (list 10 20 30 40 50)))
(print "Lodash capitalize:" (_/capitalize "omnilisp polyglot"))`,
  },
  {
    name: 'dayjs',
    description: 'Fast 2kB alternative to Moment.js with largely the same modern API.',
    category: 'date',
    suggestedAlias: 'dayjs',
    popularExports: ['format', 'unix', 'diff', 'add', 'subtract', 'isValid'],
    sampleCode: `(import-npm "dayjs" :as dayjs)
(print "Today formatted:" (dayjs/format "YYYY-MM-DD HH:mm:ss"))
(print "Unix timestamp:" (dayjs/unix))`,
  },
  {
    name: 'uuid',
    description: 'RFC4122 UUIDs generator for unique IDs (v4, v1, etc.).',
    category: 'utility',
    suggestedAlias: 'uuid',
    popularExports: ['v4', 'v1', 'validate', 'version'],
    sampleCode: `(import-npm "uuid" :as uuid)
(print "Generated UUID v4:" (uuid/v4))
(print "UUID valid?:" (uuid/validate (uuid/v4)))`,
  },
  {
    name: 'canvas-confetti',
    description: 'Performant confetti animations for web apps.',
    category: 'fx',
    suggestedAlias: 'confetti',
    popularExports: ['confetti', 'create'],
    sampleCode: `(import-npm "canvas-confetti" :as confetti)
(confetti)
(print "Confetti blast triggered!")`,
  },
  {
    name: 'mathjs',
    description: 'Extensive math library for JavaScript and Node.js.',
    category: 'math',
    suggestedAlias: 'mathjs',
    popularExports: ['evaluate', 'derivative', 'factorial', 'combinations', 'matrix'],
    sampleCode: `(import-npm "mathjs" :as mathjs)
(print "Mathjs evaluate 12 / (2.3 + 0.7):" (mathjs/evaluate "12 / (2.3 + 0.7)"))
(print "Mathjs factorial 7:" (mathjs/factorial 7))`,
  },
  {
    name: 'ramda',
    description: 'A practical functional library for JavaScript programmers.',
    category: 'functional',
    suggestedAlias: 'R',
    popularExports: ['add', 'multiply', 'pipe', 'compose', 'curry', 'filter'],
    sampleCode: `(import-npm "ramda" :as R)
(print "Ramda add 20 + 22:" (R/add 20 22))
(print "Ramda multiply 6 * 7:" (R/multiply 6 7))`,
  },
];

// Offline built-in fallbacks for core popular packages so they work seamlessly in all environments
const BUILTIN_FALLBACKS: Record<string, Record<string, any>> = {
  lodash: {
    chunk: (arr: any[], size = 1) => {
      const res: any[][] = [];
      for (let i = 0; i < (arr || []).length; i += size) {
        res.push(arr.slice(i, i + size));
      }
      return res;
    },
    compact: (arr: any[]) => (arr || []).filter(Boolean),
    flatten: (arr: any[]) => (arr || []).flat(),
    reverse: (arr: any[]) => [...(arr || [])].reverse(),
    uniq: (arr: any[]) => Array.from(new Set(arr || [])),
    shuffle: (arr: any[]) => [...(arr || [])].sort(() => Math.random() - 0.5),
    capitalize: (str: string) =>
      typeof str === 'string' && str.length > 0
        ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
        : '',
    kebabCase: (str: string) =>
      typeof str === 'string'
        ? str
            .replace(/([a-z])([A-Z])/g, '$1-$2')
            .replace(/\s+/g, '-')
            .toLowerCase()
        : '',
    camelCase: (str: string) =>
      typeof str === 'string'
        ? str.replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
        : '',
    sum: (arr: number[]) => (arr || []).reduce((a, b) => a + b, 0),
    mean: (arr: number[]) => ((arr || []).length ? (arr || []).reduce((a, b) => a + b, 0) / arr.length : 0),
  },
  dayjs: {
    format: (template?: string) => {
      const now = new Date();
      if (!template) return now.toISOString();
      const pad = (n: number) => String(n).padStart(2, '0');
      return template
        .replace('YYYY', String(now.getFullYear()))
        .replace('MM', pad(now.getMonth() + 1))
        .replace('DD', pad(now.getDate()))
        .replace('HH', pad(now.getHours()))
        .replace('mm', pad(now.getMinutes()))
        .replace('ss', pad(now.getSeconds()));
    },
    unix: () => Math.floor(Date.now() / 1000),
    isValid: () => true,
  },
  uuid: {
    v4: () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },
    v1: () => `00000000-0000-1000-8000-${Date.now().toString(16).padStart(12, '0')}`,
    validate: (id: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id)),
  },
  'canvas-confetti': {
    confetti: () => {
      // Create lightweight falling confetti particles on the browser screen
      try {
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.inset = '0';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '9999';
        document.body.appendChild(container);

        const colors = ['#6366f1', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
        for (let i = 0; i < 40; i++) {
          const bit = document.createElement('div');
          bit.style.position = 'absolute';
          bit.style.width = '8px';
          bit.style.height = '12px';
          bit.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
          bit.style.left = `${Math.random() * 100}vw`;
          bit.style.top = '-20px';
          bit.style.transform = `rotate(${Math.random() * 360}deg)`;
          bit.style.transition = `top 1.2s ease-out, transform 1.2s ease-out, opacity 1.2s`;
          container.appendChild(bit);

          setTimeout(() => {
            bit.style.top = `${60 + Math.random() * 35}vh`;
            bit.style.transform = `rotate(${Math.random() * 720}deg) scale(0.8)`;
            bit.style.opacity = '0';
          }, 30);
        }

        setTimeout(() => {
          container.remove();
        }, 1500);
      } catch {}
      return 'Confetti!';
    },
  },
  ramda: {
    add: (a: number, b: number) => a + b,
    multiply: (a: number, b: number) => a * b,
    subtract: (a: number, b: number) => a - b,
    divide: (a: number, b: number) => a / b,
    equals: (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b),
    isEmpty: (val: any) => !val || (Array.isArray(val) && val.length === 0),
  },
};

export class NpmManager {
  private cache = new Map<string, any>();
  private loadedPackages: string[] = [];

  /**
   * Dynamically fetch and load an NPM package via ESM CDN
   */
  public async loadPackage(pkgName: string): Promise<any> {
    const cleanName = pkgName.trim();
    if (this.cache.has(cleanName)) {
      return this.cache.get(cleanName);
    }

    let loadedModule: any = null;

    // 1. Check built-in fallback first for instant zero-latency loading
    const bareName = cleanName.split('@')[0];
    if (BUILTIN_FALLBACKS[bareName]) {
      loadedModule = BUILTIN_FALLBACKS[bareName];
    }

    // 2. Try fetching from ESM CDN (esm.sh or unpkg)
    if (!loadedModule && typeof window !== 'undefined') {
      try {
        const cdnUrl = `https://esm.sh/${cleanName}?bundle`;
        /* @vite-ignore */
        const mod = await import(/* @vite-ignore */ cdnUrl);
        loadedModule = mod.default || mod;
      } catch (cdnErr) {
        try {
          const fallbackUrl = `https://cdn.jsdelivr.net/npm/${cleanName}/+esm`;
          /* @vite-ignore */
          const mod = await import(/* @vite-ignore */ fallbackUrl);
          loadedModule = mod.default || mod;
        } catch {}
      }
    }

    if (!loadedModule) {
      if (BUILTIN_FALLBACKS[bareName]) {
        loadedModule = BUILTIN_FALLBACKS[bareName];
      } else {
        throw new Error(
          `Failed to load NPM package '${cleanName}'. Check package name or network connectivity.`
        );
      }
    }

    this.cache.set(cleanName, loadedModule);
    if (!this.loadedPackages.includes(cleanName)) {
      this.loadedPackages.push(cleanName);
    }
    return loadedModule;
  }

  /**
   * Bind all exports of an NPM module into the OmniLisp Environment
   */
  public bindModuleToEnv(
    pkgName: string,
    mod: any,
    alias: string | null,
    env: Env
  ): { boundSymbols: string[] } {
    const boundSymbols: string[] = [];
    const prefix = alias ? `${alias}/` : '';
    const dotPrefix = alias ? `${alias}.` : '';

    // If module itself is a callable function (e.g. dayjs or confetti)
    if (typeof mod === 'function') {
      const callableName = alias || pkgName;
      env.define(callableName, {
        type: 'js_function',
        fn: (...args: any[]) => mod(...args),
      } as LispJsFunction);
      boundSymbols.push(callableName);
    }

    // Extract all methods and properties
    const keys = new Set<string>();
    if (typeof mod === 'object' && mod !== null) {
      Object.keys(mod).forEach(k => keys.add(k));
    }
    if (typeof mod === 'function') {
      Object.getOwnPropertyNames(mod).forEach(k => {
        if (!['prototype', 'name', 'length'].includes(k)) keys.add(k);
      });
    }

    for (const key of keys) {
      const val = mod[key];
      const lispKey = key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

      if (typeof val === 'function') {
        const jsFn: LispJsFunction = {
          type: 'js_function',
          fn: (...args: any[]) => {
            try {
              return val(...args);
            } catch (err: any) {
              // Try binding `this` if method relies on parent module
              return val.apply(mod, args);
            }
          },
        };

        if (alias) {
          env.define(`${prefix}${key}`, jsFn);
          env.define(`${dotPrefix}${key}`, jsFn);
          if (lispKey !== key) {
            env.define(`${prefix}${lispKey}`, jsFn);
            env.define(`${dotPrefix}${lispKey}`, jsFn);
          }
          boundSymbols.push(`${prefix}${key}`);
        } else {
          env.define(key, jsFn);
          if (lispKey !== key) env.define(lispKey, jsFn);
          boundSymbols.push(key);
        }
      } else {
        // Value / constant
        if (alias) {
          env.define(`${prefix}${key}`, val);
          env.define(`${dotPrefix}${key}`, val);
          boundSymbols.push(`${prefix}${key}`);
        } else {
          env.define(key, val);
          boundSymbols.push(key);
        }
      }
    }

    // Also register the module object itself under alias
    if (alias) {
      env.define(alias, mod);
    }

    return { boundSymbols };
  }

  public getLoadedPackages(): string[] {
    return [...this.loadedPackages];
  }
}

export const npmManager = new NpmManager();
