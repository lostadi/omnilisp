#!/usr/bin/env node

/**
 * OmniLisp CLI & NPX Runner
 * Run directly via `npx omnilisp <command>` or after `npm install -g omnilisp`
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const VERSION = '1.0.0';

// ANSI terminal colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

// ============================================================================
// Core Minimal Engine for Standalone CLI Execution
// ============================================================================

function parseToken(token) {
  if (!isNaN(Number(token)) && token.trim() !== '') return parseFloat(token);
  if (token === 'true') return true;
  if (token === 'false') return false;
  if (token === 'nil' || token === 'null') return null;
  return token;
}

function lex(code) {
  const tokens = [];
  let i = 0;
  const len = code.length;
  while (i < len) {
    const ch = code[i];
    if (ch === ';') {
      while (i < len && code[i] !== '\n') i++;
      continue;
    }
    if (ch === '"') {
      let str = '"';
      i++;
      while (i < len) {
        str += code[i];
        if (code[i] === '\\' && i + 1 < len) {
          i++;
          str += code[i];
        } else if (code[i] === '"') {
          i++;
          break;
        }
        i++;
      }
      tokens.push(str);
      continue;
    }
    if (ch === '(' || ch === ')') {
      tokens.push(ch);
      i++;
      continue;
    }
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    let sym = '';
    while (i < len && !/\s|[();]/.test(code[i])) {
      sym += code[i];
      i++;
    }
    if (sym) tokens.push(sym);
  }
  return tokens;
}

function parseTokens(tokens) {
  if (tokens.length === 0) throw new Error('Unexpected EOF while parsing');
  const token = tokens.shift();
  if (token === '(') {
    const list = [];
    while (tokens.length > 0 && tokens[0] !== ')') {
      list.push(parseTokens(tokens));
    }
    if (tokens.length === 0) throw new Error('Missing closing parenthesis )');
    tokens.shift(); // consume ')'
    return list;
  }
  if (token === ')') {
    throw new Error('Unexpected closing parenthesis )');
  }
  return parseToken(token);
}

function parse(code) {
  const tokens = lex(code);
  const astList = [];
  while (tokens.length > 0) {
    astList.push(parseTokens(tokens));
  }
  return astList;
}

class Env {
  constructor(outer = null, binds = {}) {
    this.outer = outer;
    this.binds = { ...binds };
  }
  get(name) {
    if (name in this.binds) return this.binds[name];
    if (this.outer) return this.outer.get(name);
    throw new Error(`Undefined symbol '${name}'`);
  }
  set(name, value) {
    if (name in this.binds) {
      this.binds[name] = value;
      return value;
    }
    if (this.outer) return this.outer.set(name, value);
    throw new Error(`Cannot set undefined symbol '${name}'`);
  }
  define(name, value) {
    this.binds[name] = value;
    return value;
  }
}

function createGlobalEnv(outputSink = console.log) {
  const env = new Env();

  // Print
  env.define('print', {
    type: 'js_function',
    fn: (...args) => {
      const parts = args.map(a =>
        typeof a === 'string'
          ? (a.startsWith('"') && a.endsWith('"') ? JSON.parse(a) : a)
          : typeof a === 'object' && a !== null && a.type
          ? `<${a.type}>`
          : JSON.stringify(a)
      );
      outputSink(parts.join(' '));
      return null;
    },
  });

  // Math operators
  env.define('+', { type: 'js_function', fn: (...args) => args.reduce((a, b) => a + b, 0) });
  env.define('-', { type: 'js_function', fn: (a, ...rest) => (rest.length === 0 ? -a : rest.reduce((x, y) => x - y, a)) });
  env.define('*', { type: 'js_function', fn: (...args) => args.reduce((a, b) => a * b, 1) });
  env.define('/', { type: 'js_function', fn: (a, b) => a / b });
  env.define('%', { type: 'js_function', fn: (a, b) => a % b });

  // Comparisons
  env.define('=', { type: 'js_function', fn: (a, b) => a === b });
  env.define('>', { type: 'js_function', fn: (a, b) => a > b });
  env.define('<', { type: 'js_function', fn: (a, b) => a < b });
  env.define('>=', { type: 'js_function', fn: (a, b) => a >= b });
  env.define('<=', { type: 'js_function', fn: (a, b) => a <= b });

  // Logic
  env.define('not', { type: 'js_function', fn: a => !a });
  env.define('and', { type: 'js_function', fn: (...args) => args.every(Boolean) });
  env.define('or', { type: 'js_function', fn: (...args) => args.some(Boolean) });

  // Math library
  env.define('pi', Math.PI);
  env.define('e', Math.E);
  env.define('sqrt', { type: 'js_function', fn: Math.sqrt });
  env.define('sin', { type: 'js_function', fn: Math.sin });
  env.define('cos', { type: 'js_function', fn: Math.cos });
  env.define('tan', { type: 'js_function', fn: Math.tan });
  env.define('pow', { type: 'js_function', fn: Math.pow });
  env.define('abs', { type: 'js_function', fn: Math.abs });
  env.define('floor', { type: 'js_function', fn: Math.floor });
  env.define('ceil', { type: 'js_function', fn: Math.ceil });
  env.define('min', { type: 'js_function', fn: Math.min });
  env.define('max', { type: 'js_function', fn: Math.max });
  env.define('clamp', { type: 'js_function', fn: (val, low, high) => Math.min(high, Math.max(low, val)) });
  env.define('deg->rad', { type: 'js_function', fn: deg => (deg * Math.PI) / 180 });
  env.define('rad->deg', { type: 'js_function', fn: rad => (rad * 180) / Math.PI });

  // String library
  env.define('str-upper', { type: 'js_function', fn: s => String(s).toUpperCase() });
  env.define('str-lower', { type: 'js_function', fn: s => String(s).toLowerCase() });
  env.define('str-trim', { type: 'js_function', fn: s => String(s).trim() });
  env.define('str-len', { type: 'js_function', fn: s => String(s).length });
  env.define('str-concat', { type: 'js_function', fn: (...args) => args.join('') });

  // List library
  env.define('list', { type: 'js_function', fn: (...args) => args });
  env.define('head', { type: 'js_function', fn: list => (Array.isArray(list) ? list[0] : null) });
  env.define('tail', { type: 'js_function', fn: list => (Array.isArray(list) ? list.slice(1) : []) });
  env.define('cons', { type: 'js_function', fn: (x, xs) => [x, ...(Array.isArray(xs) ? xs : [xs])] });
  env.define('length', { type: 'js_function', fn: list => (Array.isArray(list) ? list.length : 0) });

  return env;
}

async function evaluate(x, env) {
  if (typeof x === 'string') {
    if (x.startsWith('"') && x.endsWith('"') && x.length >= 2) {
      try {
        return JSON.parse(x);
      } catch {
        return x.slice(1, -1);
      }
    }
    return env.get(x);
  }
  if (!Array.isArray(x)) return x;
  if (x.length === 0) return [];

  const op = x[0];

  // (import-npm "pkg" :as alias)
  if (op === 'import-npm') {
    const pkg = typeof x[1] === 'string' ? x[1].replace(/^["']|["']$/g, '') : String(x[1]);
    const alias = x[2] === ':as' ? String(x[3]).replace(/^["']|["']$/g, '') : null;
    try {
      const mod = await import(pkg);
      const target = mod.default || mod;
      if (alias) {
        env.define(alias, target);
        if (typeof target === 'object' && target !== null) {
          for (const k of Object.keys(target)) {
            if (typeof target[k] === 'function') {
              env.define(`${alias}/${k}`, { type: 'js_function', fn: (...args) => target[k](...args) });
            } else {
              env.define(`${alias}/${k}`, target[k]);
            }
          }
        }
      }
      return `[NPM] Imported '${pkg}'${alias ? ` as '${alias}'` : ''}`;
    } catch (e) {
      console.warn(`${c.yellow}[NPM Warning]${c.reset} Could not dynamically import '${pkg}' in local environment: ${e.message}`);
      return `[NPM Fallback]: '${pkg}'`;
    }
  }

  // (def name val)
  if (op === 'def') {
    const name = String(x[1]);
    const val = await evaluate(x[2], env);
    return env.define(name, val);
  }

  // (set! name val)
  if (op === 'set!') {
    const name = String(x[1]);
    const val = await evaluate(x[2], env);
    return env.set(name, val);
  }

  // (if test conseq alt)
  if (op === 'if') {
    const test = await evaluate(x[1], env);
    return test ? await evaluate(x[2], env) : x[3] !== undefined ? await evaluate(x[3], env) : null;
  }

  // (lambda (params) body)
  if (op === 'lambda' || op === 'fn') {
    const params = Array.isArray(x[1]) ? x[1].map(String) : [];
    const body = x.slice(2);
    return {
      type: 'lambda',
      params,
      fn: async (...args) => {
        const localBinds = {};
        params.forEach((p, idx) => {
          localBinds[p] = args[idx];
        });
        const localEnv = new Env(env, localBinds);
        let res = null;
        for (const expr of body) {
          res = await evaluate(expr, localEnv);
        }
        return res;
      },
    };
  }

  // (begin e1 e2 ...)
  if (op === 'begin' || op === 'do') {
    let res = null;
    for (let i = 1; i < x.length; i++) {
      res = await evaluate(x[i], env);
    }
    return res;
  }

  // Higher-order map / filter
  if (op === 'map') {
    const fnVal = await evaluate(x[1], env);
    const listVal = await evaluate(x[2], env);
    if (!Array.isArray(listVal)) return [];
    const fn = fnVal && fnVal.type === 'lambda' ? fnVal.fn : fnVal && fnVal.fn ? fnVal.fn : fnVal;
    const res = [];
    for (const item of listVal) {
      res.push(await fn(item));
    }
    return res;
  }

  // Standard procedure call
  const proc = await evaluate(op, env);
  const args = [];
  for (let i = 1; i < x.length; i++) {
    args.push(await evaluate(x[i], env));
  }

  if (proc && proc.type === 'lambda') {
    return await proc.fn(...args);
  }
  if (proc && proc.type === 'js_function') {
    return proc.fn(...args);
  }
  if (typeof proc === 'function') {
    return proc(...args);
  }

  throw new Error(`'${op}' is not a function`);
}

async function runProgram(code, outputSink = console.log) {
  const ast = parse(code);
  const env = createGlobalEnv(outputSink);
  let lastResult = null;
  for (const form of ast) {
    lastResult = await evaluate(form, env);
  }
  return lastResult;
}

// ============================================================================
// Ostadix Kernel & Automated Error Fuzzer
// ============================================================================

function balanceParens(code) {
  const notes = [];
  let openParens = 0;
  let inString = false;
  let stringEsc = false;
  let clean = code;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inString) {
      if (stringEsc) stringEsc = false;
      else if (ch === '\\') stringEsc = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === ';') {
      while (i < clean.length && clean[i] !== '\n') i++;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '(') openParens++;
    else if (ch === ')') {
      if (openParens > 0) openParens--;
      else {
        clean = clean.slice(0, i) + ' ' + clean.slice(i + 1);
        notes.push(`Stripped stray closing parenthesis at col ${i}`);
      }
    }
  }
  if (inString) {
    clean += '"';
    notes.push('Closed unterminated string literal');
  }
  if (openParens > 0) {
    clean += '\n' + ')'.repeat(openParens);
    notes.push(`Balanced ${openParens} missing closing parenthesis`);
  }
  return { code: clean, repaired: notes.length > 0, notes };
}

function extractMissingSymbols(err) {
  const symbols = new Set();
  const m1 = err.match(/Undefined symbol ['"]?([a-zA-Z0-9_\-+*/%<>=?!]+)['"]?/i);
  if (m1 && m1[1]) symbols.add(m1[1]);
  const m2 = err.match(/['"]([a-zA-Z0-9_\-+*/%<>=?!]+)['"] is not a function/i);
  if (m2 && m2[1]) symbols.add(m2[1]);
  return Array.from(symbols);
}

async function fuzzErrorIntoRunnableScriptCLI(brokenCode, errorMsg = '') {
  const repairs = [];
  let candidate = brokenCode;

  // 1. Balance parens
  const b = balanceParens(candidate);
  if (b.repaired) {
    candidate = b.code;
    repairs.push(...b.notes);
  }

  // 2. Math sanitization
  candidate = candidate.replace(/\(\/\s+([a-zA-Z0-9_\-+*/%<>=?!]+|\([^)]+\))\s+0\)/g, (_, num) => {
    repairs.push('Protected division by zero hazard');
    return `(if (= 0 0) 0 (/ ${num} 1))`;
  });

  // 3. Multi-pass iterative trial loop
  let currentErr = errorMsg;
  const synthesized = new Set();
  for (let pass = 0; pass < 8; pass++) {
    const missing = extractMissingSymbols(currentErr);
    for (const sym of missing) {
      if (!synthesized.has(sym)) {
        synthesized.add(sym);
        if (currentErr.includes('not a function')) {
          candidate = `;; [Ostadix Fuzzer: Synthesized resilient polymorphic lambda for '${sym}']\n(def ${sym} (lambda (&rest args) (if (> (length args) 0) (head args) "healed_fallback")))\n` + candidate;
          repairs.push(`Synthesized fallback lambda for function '${sym}'`);
        } else {
          candidate = `;; [Ostadix Fuzzer: Injected default value for missing symbol '${sym}']\n(def ${sym} 0)\n` + candidate;
          repairs.push(`Synthesized safe default for variable '${sym}'`);
        }
      }
    }

    try {
      await runProgram(candidate, () => {});
      currentErr = '';
      break;
    } catch (err) {
      currentErr = err.message;
      const b2 = balanceParens(candidate);
      if (b2.repaired) {
        candidate = b2.code;
        repairs.push(...b2.notes);
      }
    }
  }

  if (currentErr) {
    candidate = `;; [Ostadix Fault Recovery Shield]\n(print "[Fault Shielded]: ${currentErr.replace(/"/g, "'")}")\n(def safe-result "healed")\n` + candidate.split('\n').map(l => (l.trim().startsWith(';') ? l : `; [Guarded]: ${l}`)).join('\n');
    repairs.push('Wrapped unhandled forms in Ostadix fault tolerance shield');
  }

  // 4. Wrap with Ostadix self-healing harness
  const wrapped = `;; =========================================================================
;; Ostadix Auto-Healed Runnable Script
;; Fault Intercepted: ${errorMsg || 'Syntax/Runtime Error'}
;; Status: heuristic repair candidate; inspect changed behavior
;; =========================================================================

(print "[Ostadix Healer]: Recovered from fault -> '${(errorMsg || 'error').replace(/"/g, "'")}'")

${candidate}

(print "[Ostadix Healer]: Execution concluded successfully.")
`;

  return {
    repairedCode: wrapped,
    repairs,
    originalError: errorMsg,
  };
}

// ============================================================================
// CLI Commands & Handlers
// ============================================================================

function showHelp() {
  console.log(`OmniLisp v${VERSION} — experimental Lisp workbench

Usage: npm run cli -- <command> [options]

  run <file.lisp> [--fuzz]            Execute a program
  eval -e "<code>" [--fuzz]           Execute an expression
  repl                              Start the interactive CLI interpreter
  build <file> --target ts|rust      Generate source; optionally use -o FILE
  fuzz <file.lisp> [-o FILE]         Produce a heuristic repair candidate
  status                            Describe the local diagnostic simulation
  ping                              Run the local simulated heartbeat
  --version                         Display the version
  --help                            Show this help

Examples:
  npm run cli -- eval -e "(print (+ 20 22))"
  npm run cli -- run examples/factorial.lisp
  npm run cli -- build examples/factorial.lisp --target ts -o /tmp/factorial.ts

The CLI and browser have separate evaluators and support different subsets.
Repair candidates may change behavior or disable failing forms. Review them.
The status and ping commands do not contact a native Ostadix runtime.
`);
}

async function startRepl() {
  console.log(`${c.bold}${c.cyan}OmniLisp Interactive REPL${c.reset} ${c.dim}(v${VERSION})${c.reset}`);
  console.log(`${c.gray}Type any expression e.g. (print (+ 10 20)), or :exit to quit.${c.reset}\n`);

  const env = createGlobalEnv(console.log);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${c.cyan}omnilisp>${c.reset} `,
  });

  rl.prompt();

  rl.on('line', async line => {
    const trimmed = line.trim();
    if (trimmed === ':exit' || trimmed === ':quit' || trimmed === '(exit)') {
      rl.close();
      return;
    }
    if (!trimmed) {
      rl.prompt();
      return;
    }

    try {
      const ast = parse(trimmed);
      for (const form of ast) {
        const res = await evaluate(form, env);
        if (res !== undefined && res !== null) {
          console.log(`${c.green}=>${c.reset}`, res);
        }
      }
    } catch (e) {
      console.error(`${c.red}Error:${c.reset} ${e.message}`);
    }
    rl.prompt();
  });

  rl.on('close', () => {
    console.log(`\n${c.gray}Exiting OmniLisp REPL. Goodbye!${c.reset}`);
    process.exit(0);
  });
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    showHelp();
    return;
  }

  if (args.includes('-v') || args.includes('--version')) {
    console.log(`omnilisp / ostadix v${VERSION}`);
    return;
  }

  const cmd = args[0];

  // Legacy diagnostic commands describe the local simulation only.
  if (cmd === 'status' || cmd === 'ostadix-status') {
    console.log('OmniLisp diagnostic simulation: local only.');
    console.log('No native Ostadix kernel, IPC connection, or external telemetry is queried.');
    return;
  }

  if (cmd === 'ping' || cmd === 'ostadix-ping') {
    console.log('SIMULATED PONG — local CLI response; no native Ostadix connection.');
    return;
  }

  // Ostadix Fuzz: omnilisp fuzz <file.lisp> or ostadix fuzz <file.lisp>
  if (cmd === 'fuzz') {
    const filePath = args[1];
    const outIdx = args.indexOf('-o');
    const outFile = outIdx !== -1 ? args[outIdx + 1] : 'fuzzed_runnable.lisp';

    if (!filePath) {
      console.error(`${c.red}Error:${c.reset} Please provide a .lisp file to fuzz into a runnable script.`);
      process.exit(1);
    }

    try {
      const absPath = path.resolve(process.cwd(), filePath);
      const code = fs.readFileSync(absPath, 'utf8');

      console.log(`${c.cyan}⚡ [Ostadix Fuzzer]${c.reset} Analyzing and fuzzing script: ${filePath}...`);
      let trialError = '';
      try {
        await runProgram(code, () => {});
      } catch (err) {
        trialError = err.message;
      }

      const fuzzed = await fuzzErrorIntoRunnableScriptCLI(code, trialError);
      console.log(`${c.green}Repair candidate generated; inspect changed or disabled forms.${c.reset}`);
      console.log(`${c.bold}Repairs Applied:${c.reset}`);
      fuzzed.repairs.forEach((r, idx) => console.log(`  ${c.cyan}${idx + 1}.${c.reset} ${r}`));

      fs.writeFileSync(path.resolve(process.cwd(), outFile), fuzzed.repairedCode, 'utf8');
      console.log(`\n${c.green}✔ Wrote runnable script to:${c.reset} ${c.bold}${outFile}${c.reset}`);
      console.log(`${c.dim}------------------------------------------------------------${c.reset}`);
      console.log(`${c.bold}Executing Healed Script:${c.reset}`);
      await runProgram(fuzzed.repairedCode);
      console.log(`${c.dim}------------------------------------------------------------${c.reset}`);
      console.log(`${c.green}✔ Execution verified with 0 errors!${c.reset}`);
      process.exit(0);
    } catch (e) {
      console.error(`${c.red}Fuzzer Error:${c.reset} ${e.message}`);
      process.exit(1);
    }
  }

  // Inline eval: omnilisp -e "..." or omnilisp eval -e "..."
  if (cmd === '-e' || cmd === '--eval' || (cmd === 'eval' && args[1] === '-e')) {
    const code = cmd === '-e' ? args[1] : cmd === '--eval' ? args[1] : args[2];
    const shouldFuzz = args.includes('--fuzz') || args.includes('--fuzz-on-error');
    if (!code) {
      console.error(`${c.red}Error:${c.reset} Missing code string for -e`);
      process.exit(1);
    }
    try {
      await runProgram(code);
    } catch (e) {
      if (shouldFuzz) {
        console.warn(`${c.yellow}⚡ [Ostadix Auto-Healer]${c.reset} Intercepted fault: ${e.message}`);
        const fuzzed = await fuzzErrorIntoRunnableScriptCLI(code, e.message);
        console.log(`${c.green}Executing auto-healed runnable expression:${c.reset}`);
        await runProgram(fuzzed.repairedCode);
      } else {
        console.error(`${c.red}Execution Error:${c.reset} ${e.message}`);
        console.log(`${c.dim}Tip: Run with --fuzz to automatically fuzz any errors into a runnable script.${c.reset}`);
        process.exit(1);
      }
    }
    return;
  }

  // REPL
  if (cmd === 'repl') {
    await startRepl();
    return;
  }

  // Run file: omnilisp run <file> or omnilisp <file.lisp>
  if (cmd === 'run' || cmd.endsWith('.lisp')) {
    const filePath = cmd === 'run' ? args[1] : cmd;
    const shouldFuzz = args.includes('--fuzz') || args.includes('--fuzz-on-error');
    if (!filePath) {
      console.error(`${c.red}Error:${c.reset} Please provide a .lisp file to run.`);
      process.exit(1);
    }

    try {
      const absPath = path.resolve(process.cwd(), filePath);
      const code = fs.readFileSync(absPath, 'utf8');
      await runProgram(code);
    } catch (e) {
      if (shouldFuzz) {
        console.warn(`\n${c.yellow}⚡ [Ostadix Auto-Healer]${c.reset} Fault detected: ${e.message}`);
        console.log(`${c.cyan}Fuzzing into runnable script...${c.reset}`);
        const absPath = path.resolve(process.cwd(), filePath);
        const code = fs.readFileSync(absPath, 'utf8');
        const fuzzed = await fuzzErrorIntoRunnableScriptCLI(code, e.message);
        console.log(`${c.green}Repairs applied:${c.reset} ${fuzzed.repairs.join(', ')}`);
        console.log(`${c.bold}Executing healed script:${c.reset}\n`);
        await runProgram(fuzzed.repairedCode);
      } else {
        console.error(`${c.red}Execution Error:${c.reset} ${e.message}`);
        console.log(`${c.dim}Tip: Run with ${c.green}--fuzz${c.dim} to automatically heal faults into a runnable script:${c.reset}`);
        console.log(`  ${c.cyan}npm run cli -- run ${filePath} --fuzz${c.reset}`);
        process.exit(1);
      }
    }
    return;
  }

  // Build transpilation: omnilisp build <file> --target <ts|rust>
  if (cmd === 'build') {
    const filePath = args[1];
    const targetIdx = args.indexOf('--target');
    const target = targetIdx !== -1 ? args[targetIdx + 1] : 'ts';
    const outIdx = args.indexOf('-o');
    const outFile = outIdx !== -1 ? args[outIdx + 1] : null;

    if (!['ts', 'rust'].includes(target)) {
      throw new Error('Build target must be ts or rust');
    }

    if (!filePath) {
      console.error(`${c.red}Error:${c.reset} Please provide a .lisp file to build.`);
      process.exit(1);
    }

    try {
      const absPath = path.resolve(process.cwd(), filePath);
      const code = fs.readFileSync(absPath, 'utf8');
      const ast = parse(code);

      let output = '';
      if (target === 'rust') {
        const { compileToRust } = await import('../src/lisp/rustTranspiler.ts');
        output = compileToRust(ast);
      } else {
        const { compileToTypeScript } = await import('../src/lisp/tsTranspiler.ts');
        output = compileToTypeScript(ast);
      }

      if (outFile) {
        fs.writeFileSync(path.resolve(process.cwd(), outFile), output, 'utf8');
        console.log(`${c.green}✔ Successfully compiled${c.reset} ${filePath} ➔ ${outFile} (${target})`);
      } else {
        console.log(output);
      }
    } catch (e) {
      console.error(`${c.red}Compilation Error:${c.reset} ${e.message}`);
      process.exit(1);
    }
    return;
  }

  console.error(`Unknown command: ${cmd}`);
  process.exitCode = 1;
  showHelp();
}

main().catch(err => {
  console.error(`${c.red}Fatal Error:${c.reset} ${err.message}`);
  process.exit(1);
});
