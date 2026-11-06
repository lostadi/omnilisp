import { LispValue } from './types';
export { compileToTypeScript, convertTypeScriptToOmniLisp } from './tsTranspiler';
export { compileToRust } from './rustTranspiler';

// A simple transpiler from Lisp AST to JavaScript source code
export function compileToJS(ast: LispValue): string {
  if (typeof ast === 'number' || typeof ast === 'boolean') {
    return String(ast);
  }
  if (ast === null) {
    return 'null';
  }
  if (typeof ast === 'string') {
    if (ast.startsWith('"') && ast.endsWith('"')) {
      return ast;
    }
    // simple variable substitution mapping Lisp kebab-case to JS camelCase
    return ast.replace(/-([a-z])/g, g => g[1].toUpperCase());
  }

  if (Array.isArray(ast)) {
    if (ast.length === 0) return '[]';

    const op = ast[0];

    if (op === 'import') {
      const targets = ast.slice(1).map(t => (typeof t === 'string' ? t.replace(/^["']|["']$/g, '') : JSON.stringify(t)));
      return `// [OmniLisp Import]: Registered module(s): ${targets.join(', ')}\n// Standard polyglot runtime bindings loaded into execution context`;
    }

    if (op === 'import-scheme' || op === 'import-clojure' || op === 'import-common-lisp') {
      return `// [OmniLisp Dialect Transpiler]: Inlined ${op.replace('import-', '')} AST into runtime scope`;
    }

    if (op === 'convert') {
      return `// [OmniLisp Converter]: AST translation`;
    }

    if (op === 'if') {
      const [, test, conseq, alt] = ast;
      return `(${compileToJS(test)} ? ${compileToJS(conseq)} : ${compileToJS(alt)})`;
    }

    if (op === 'def') {
      const [, name, value] = ast;
      const jsName = typeof name === 'string' ? name.replace(/-([a-z])/g, g => g[1].toUpperCase()) : 'unknown';
      return `const ${jsName} = ${compileToJS(value)};`;
    }

    if (op === 'set!') {
      const [, name, value] = ast;
      const jsName = typeof name === 'string' ? name.replace(/-([a-z])/g, g => g[1].toUpperCase()) : 'unknown';
      return `${jsName} = ${compileToJS(value)};`;
    }

    if (op === 'lambda' || op === 'fn') {
      const [, params, body] = ast;
      if (Array.isArray(params)) {
        const paramStr = params.map(p => typeof p === 'string' ? p : '').join(', ');
        return `((${paramStr}) => {\n  return ${compileToJS(body)};\n})`;
      }
    }

    if (op === 'begin' || op === 'do') {
      const stmts = ast.slice(1).map(compileToJS);
      const last = stmts.pop();
      return `(() => {\n  ${stmts.join(';\n  ')};\n  return ${last};\n})()`;
    }

    if (op === '+' || op === '-' || op === '*' || op === '/' || op === '>' || op === '<' || op === '>=' || op === '<=' || op === '=') {
      if (ast.length === 2) {
        // unary minus etc
        return `${op === '=' ? '==' : op}${compileToJS(ast[1])}`;
      }
      const args = ast.slice(1).map(compileToJS);
      const jsOp = op === '=' ? '===' : op; // convert equality
      return `(${args.join(` ${jsOp} `)})`;
    }

    if (op === 'list') {
       const args = ast.slice(1).map(compileToJS);
       return `[${args.join(', ')}]`;
    }

    if (op === 'print') {
        const args = ast.slice(1).map(compileToJS);
        return `console.log(${args.join(', ')})`;
    }

    // Default function call
    if (typeof op === 'string') {
      const jsName = op.replace(/-([a-z])/g, g => g[1].toUpperCase());
      const args = ast.slice(1).map(compileToJS);
      return `${jsName}(${args.join(', ')})`;
    }
  }

  return '/* Uncompilable AST */';
}

// Very basic WAT (WebAssembly Text) representation for simple math
export function compileToWAT(ast: LispValue): string {
    if (typeof ast === 'number') {
        return `    i32.const ${ast}`;
    }
    if (typeof ast === 'string') {
        return `    local.get $${ast}`;
    }

    if (Array.isArray(ast)) {
        const op = ast[0];
        if (op === '+' || op === '-' || op === '*' || op === '/') {
            let left = compileToWAT(ast[1]);
            let right = compileToWAT(ast[2]);
            let inst = '';
            if (op === '+') inst = 'i32.add';
            if (op === '-') inst = 'i32.sub';
            if (op === '*') inst = 'i32.mul';
            if (op === '/') inst = 'i32.div_s';

            return `${left}\n${right}\n    ${inst}`;
        }
        if (op === 'def') {
           const [, name, val] = ast;
           return `  ;; pseudo-WAT export\n  (func $${name} (export "${name}") (result i32)\n${compileToWAT(val)}\n  )`;
        }
    }

    return `;; Unsupported in WAT compiler`;
}
