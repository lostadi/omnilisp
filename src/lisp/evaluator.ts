import { Env, LispValue, LispLambda, LispJsFunction, DebugContext, DebugFrame, CallGraphNode } from './types';
import { parse } from './parser';
import { moduleManager } from './modules';
import { convertDialectToOmniLisp, LispDialect } from './converter';
import { npmManager } from './npmLoader';

export function formatLispValueSummary(val: LispValue, maxLength = 30): string {
  if (val === null) return 'null';
  if (typeof val === 'string') {
    const s = JSON.stringify(val);
    return s.length > maxLength ? s.slice(0, maxLength - 3) + '..."' : s;
  }
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return '()';
    const preview = val.slice(0, 3).map(v => formatLispValueSummary(v, 10)).join(' ');
    const res = `(${preview}${val.length > 3 ? ' ...' : ''})`;
    return res.length > maxLength ? res.slice(0, maxLength - 3) + '...)' : res;
  }
  if (typeof val === 'object' && val !== null && 'type' in val) {
    if (val.type === 'lambda') return `(lambda (${val.params.join(' ')}) ...)`;
    if (val.type === 'js_function') return '<native-proc>';
  }
  return String(val);
}

async function importSingleModule(
  id: string,
  alias: string | null,
  env: Env,
  results: string[],
  context?: DebugContext
) {
  const { code, dialect, exports } = moduleManager.resolveModuleCode(id);
  if (alias) {
    const modEnv = new Env(env);
    await evaluateProgram(code, modEnv, context);
    const count = Object.keys(modEnv.binds).length;
    for (const key of Object.keys(modEnv.binds)) {
      env.define(`${alias}/${key}`, modEnv.binds[key]);
      env.define(`${alias}.${key}`, modEnv.binds[key]);
    }
    results.push(`Imported module '${id}' as '${alias}' (${count} symbols)`);
  } else {
    await evaluateProgram(code, env, context);
    results.push(`Imported module '${id}' (${dialect}, ${exports.length} symbols)`);
  }
}

export async function evaluate(
  x: LispValue,
  env: Env,
  context?: DebugContext
): Promise<LispValue> {
  // Check debugger breakpoints & stepping before executing compound expressions
  if (context && Array.isArray(x) && (x as any).__loc) {
    const loc = (x as any).__loc as { line: number; col: number };
    const line = loc.line;

    if (context.shouldStop && context.shouldStop()) {
      throw new Error('Execution halted by debugger');
    }

    const hitBreakpoint = context.breakpoints.has(line);
    const shouldPause = hitBreakpoint || context.isStepping;

    if (shouldPause && context.onPause) {
      context.isPaused = true;
      context.isStepping = false;

      const frame: DebugFrame = {
        exp: x,
        line,
        env,
        name: typeof x[0] === 'string' ? x[0] : undefined,
        depth: context.callStack.length,
      };

      context.callStack.push(frame);
      const action = await context.onPause(frame);
      context.callStack.pop();

      if (action === 'stop') {
        context.isPaused = false;
        throw new Error('Execution stopped by user');
      } else if (action === 'step') {
        context.isStepping = true;
      } else {
        context.isStepping = false;
      }
      context.isPaused = false;
    }
  }

  // 1. Strings
  if (typeof x === 'string') {
    if (x.startsWith('"') && x.endsWith('"') && x.length >= 2) {
      try {
        return JSON.parse(x);
      } catch {
        return x.slice(1, -1);
      }
    }
    return env.get(x);
  } else if (!Array.isArray(x)) {
    return x; // number, boolean, null
  } else if (x.length === 0) {
    return [];
  }

  const op = x[0];

  // 2. Module Import Syntax: (import math), (import math string), (import math :as m), (import (scheme "..."))
  if (op === 'import') {
    const results: string[] = [];
    let idx = 1;
    while (idx < x.length) {
      const item = x[idx];
      if (Array.isArray(item)) {
        const subOp = String(item[0]).replace(/^["']|["']$/g, '');
        if (subOp === 'scheme' || subOp === 'clojure' || subOp === 'common-lisp') {
          const rawCode =
            typeof item[1] === 'string'
              ? item[1].replace(/^["']|["']$/g, '')
              : String(item[1]);
          const { converted } = convertDialectToOmniLisp(rawCode, subOp as LispDialect);
          await evaluateProgram(converted, env, context);
          results.push(`Converted and imported ${subOp} code`);
        } else {
          let alias: string | null = null;
          if (item[1] === ':as' && typeof item[2] === 'string') {
            alias = item[2].replace(/^["']|["']$/g, '');
          }
          if (subOp.startsWith('npm:')) {
            const pkgName = subOp.replace('npm:', '');
            const mod = await npmManager.loadPackage(pkgName);
            const { boundSymbols } = npmManager.bindModuleToEnv(pkgName, mod, alias, env);
            results.push(`[NPM] Loaded '${pkgName}'${alias ? ` as '${alias}'` : ''} (${boundSymbols.length} symbols)`);
          } else {
            await importSingleModule(subOp, alias, env, results, context);
          }
        }
        idx++;
      } else if (typeof item === 'string') {
        const cleanItem = item.replace(/^["']|["']$/g, '');
        if (idx + 2 < x.length && x[idx + 1] === ':as' && typeof x[idx + 2] === 'string') {
          const alias = String(x[idx + 2]).replace(/^["']|["']$/g, '');
          if (cleanItem.startsWith('npm:')) {
            const pkgName = cleanItem.replace('npm:', '');
            const mod = await npmManager.loadPackage(pkgName);
            const { boundSymbols } = npmManager.bindModuleToEnv(pkgName, mod, alias, env);
            results.push(`[NPM] Loaded '${pkgName}' as '${alias}' (${boundSymbols.length} symbols)`);
          } else {
            await importSingleModule(cleanItem, alias, env, results, context);
          }
          idx += 3;
        } else {
          if (cleanItem.startsWith('npm:')) {
            const pkgName = cleanItem.replace('npm:', '');
            const mod = await npmManager.loadPackage(pkgName);
            const { boundSymbols } = npmManager.bindModuleToEnv(pkgName, mod, null, env);
            results.push(`[NPM] Loaded '${pkgName}' (${boundSymbols.length} symbols)`);
          } else {
            await importSingleModule(cleanItem, null, env, results, context);
          }
          idx++;
        }
      } else {
        idx++;
      }
    }
    return results.length === 1 ? results[0] : results.join('; ');
  }

  // 3. First-class NPM Import: (import-npm "lodash" :as _) or (import-npm "dayjs")
  if (op === 'import-npm') {
    const pkgRaw = typeof x[1] === 'string' ? x[1].replace(/^["']|["']$/g, '') : String(x[1]);
    let alias: string | null = null;
    if (x[2] === ':as' && typeof x[3] === 'string') {
      alias = x[3].replace(/^["']|["']$/g, '');
    }
    const mod = await npmManager.loadPackage(pkgRaw);
    const { boundSymbols } = npmManager.bindModuleToEnv(pkgRaw, mod, alias, env);
    return `[NPM] Successfully loaded '${pkgRaw}'${alias ? ` as '${alias}'` : ''} (${boundSymbols.length} symbols registered)`;
  }

  // 3. Direct Dialect Import Form: (import-scheme "(define ...)"), etc.
  if (op === 'import-scheme' || op === 'import-clojure' || op === 'import-common-lisp') {
    const dialect: LispDialect =
      op === 'import-scheme'
        ? 'scheme'
        : op === 'import-clojure'
        ? 'clojure'
        : 'common-lisp';
    const raw = typeof x[1] === 'string' ? x[1].replace(/^["']|["']$/g, '') : String(x[1]);
    const { converted } = convertDialectToOmniLisp(raw, dialect);
    await evaluateProgram(converted, env, context);
    return `Converted and imported ${dialect} module`;
  }

  // 4. Dialect Code Converter Utility: (convert :scheme "(define ...)")
  if (op === 'convert') {
    const dialect = String(x[1]).replace(/^[:"']|["']$/g, '') as LispDialect;
    const raw = typeof x[2] === 'string' ? x[2].replace(/^["']|["']$/g, '') : String(x[2]);
    const { converted } = convertDialectToOmniLisp(raw, dialect);
    return converted;
  }

  // 5. Special Forms
  if (op === 'if') {
    const [, test, conseq, alt] = x;
    const testResult = await evaluate(test, env, context);
    const exp = testResult ? conseq : alt;
    return await evaluate(exp, env, context);
  } else if (op === 'def') {
    const [, symbol, exp] = x;
    if (typeof symbol !== 'string') {
      throw new Error(`Invalid symbol in def: ${symbol}`);
    }
    const val = await evaluate(exp, env, context);
    env.define(symbol, val);
    return val;
  } else if (op === 'set!') {
    const [, symbol, exp] = x;
    if (typeof symbol !== 'string') {
      throw new Error(`Invalid symbol in set!: ${symbol}`);
    }
    const val = await evaluate(exp, env, context);
    env.set(symbol, val);
    return null;
  } else if (op === 'quote') {
    return x[1];
  } else if (op === 'lambda' || op === 'fn') {
    const [, params, body] = x;
    if (!Array.isArray(params)) {
      throw new Error(`lambda params must be a list`);
    }
    return {
      type: 'lambda',
      params: params as string[],
      body,
      env: env,
    } as LispLambda;
  } else if (op === 'begin' || op === 'do') {
    let scopeNode: CallGraphNode | null = null;
    const parentCallNode = context?.activeCallNode;

    if (context && context.activeCallNode) {
      scopeNode = {
        id: `scope-${++context.nodeIdCounter!}`,
        name: `(scope: ${op})`,
        type: 'scope',
        args: [],
        line: (x as any).__loc?.line,
        durationMs: 0,
        children: [],
        depth: context.activeCallNode.depth + 1,
      };
      context.activeCallNode.children.push(scopeNode);
      context.activeCallNode = scopeNode;
    }

    try {
      let result: LispValue = null;
      for (let i = 1; i < x.length; i++) {
        result = await evaluate(x[i], env, context);
      }
      if (scopeNode) {
        scopeNode.returnValue = formatLispValueSummary(result);
      }
      return result;
    } finally {
      if (context && parentCallNode) {
        context.activeCallNode = parentCallNode;
      }
    }
  } else {
    // 6. Function / Procedure Invocation
    const proc = await evaluate(x[0], env, context);
    const args: LispValue[] = [];
    for (let i = 1; i < x.length; i++) {
      args.push(await evaluate(x[i], env, context));
    }

    let fnName = 'anonymous';
    if (typeof x[0] === 'string') {
      fnName = x[0];
    } else if (typeof proc === 'object' && proc !== null && 'type' in proc && proc.type === 'lambda') {
      fnName = '(lambda)';
    }

    const startTime = performance.now();
    let callNode: CallGraphNode | null = null;
    const parentCallNode = context?.activeCallNode;

    if (context && context.activeCallNode) {
      const loc = (x as any).__loc;
      const fnType =
        typeof proc === 'object' && proc !== null && 'type' in proc && proc.type === 'lambda'
          ? 'lambda'
          : typeof proc === 'object' && proc !== null && 'type' in proc && proc.type === 'js_function'
          ? 'builtin'
          : 'function';

      callNode = {
        id: `call-${++context.nodeIdCounter!}`,
        name: fnName,
        type: fnType,
        args: args.map(a => formatLispValueSummary(a)),
        line: loc?.line,
        durationMs: 0,
        scopeVars: {},
        children: [],
        depth: context.activeCallNode.depth + 1,
      };
      context.activeCallNode.children.push(callNode);
      context.activeCallNode = callNode;
    }

    try {
      let result: LispValue;
      if (typeof proc === 'object' && proc !== null) {
        if ('type' in proc && proc.type === 'js_function') {
          result = proc.fn(...args);
        } else if ('type' in proc && proc.type === 'lambda') {
          const localEnv = new Env(proc.env);
          for (let i = 0; i < proc.params.length; i++) {
            localEnv.define(proc.params[i], args[i]);
          }
          if (callNode) {
            const vars: Record<string, string> = {};
            for (const [k, v] of Object.entries(localEnv.binds)) {
              vars[k] = formatLispValueSummary(v);
            }
            callNode.scopeVars = vars;
          }
          result = await evaluate(proc.body, localEnv, context);
        } else {
          throw new Error(`Not a function: ${JSON.stringify(proc)} from ${String(x[0])}`);
        }
      } else {
        throw new Error(`Not a function: ${JSON.stringify(proc)} from ${String(x[0])}`);
      }

      if (callNode) {
        callNode.returnValue = formatLispValueSummary(result);
        callNode.durationMs = Math.round((performance.now() - startTime) * 100) / 100;
      }
      return result;
    } finally {
      if (context && parentCallNode) {
        context.activeCallNode = parentCallNode;
      }
    }
  }
}

export async function evaluateProgram(
  program: string,
  env: Env,
  context?: DebugContext
): Promise<LispValue> {
  const astList = parse(program);
  let result: LispValue = null;

  if (context && !context.callGraphRoot) {
    const rootNode: CallGraphNode = {
      id: 'root-program',
      name: '<main>',
      type: 'program',
      args: [],
      durationMs: 0,
      children: [],
      depth: 0,
    };
    context.callGraphRoot = rootNode;
    context.activeCallNode = rootNode;
    context.nodeIdCounter = 0;
  }

  const startTime = performance.now();
  for (const ast of astList) {
    if (context?.shouldStop && context.shouldStop()) {
      break;
    }
    result = await evaluate(ast, env, context);
  }

  if (context?.callGraphRoot) {
    context.callGraphRoot.durationMs = Math.round((performance.now() - startTime) * 100) / 100;
    context.callGraphRoot.returnValue = formatLispValueSummary(result);
  }

  return result;
}
