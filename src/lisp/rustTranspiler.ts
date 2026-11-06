/**
 * OmniLisp to Rust Transpiler
 * Generates compilable, idiomatic Rust 2021/2024 source code with fn main(),
 * typed function signatures, closures, standard math primitives, and formatted println! calls.
 */

import { LispValue } from './types';

export interface RustCompileOptions {
  includeCargoComment?: boolean;
}

export function compileToRust(
  ast: LispValue | LispValue[],
  options: RustCompileOptions = {}
): string {
  const { includeCargoComment = true } = options;

  const nodes = Array.isArray(ast) && ast.length > 0 && Array.isArray(ast[0]) && typeof ast[0][0] !== 'number'
    ? (ast as LispValue[])
    : Array.isArray(ast) && (ast[0] === 'def' || ast[0] === 'import' || ast[0] === 'print' || ast[0] === 'begin')
    ? [ast]
    : Array.isArray(ast)
    ? (ast as LispValue[])
    : [ast];

  const topLevelFunctions: string[] = [];
  const mainStatements: string[] = [];
  const mutableVars = new Set<string>();

  // Helper to convert Lisp kebab-case to Rust snake_case
  function toRustId(name: string): string {
    if (typeof name !== 'string') return 'val';
    let clean = name.replace(/[?!]/g, '').replace(/-([a-z0-9])/g, (_, g) => `_${g}`).replace(/-/g, '_');
    if (clean === 'fn' || clean === 'type' || clean === 'match' || clean === 'loop' || clean === 'ref' || clean === 'move') {
      clean = `r#${clean}`;
    }
    return clean || 'item';
  }

  // Detect mutated variables across AST so we can declare them as `let mut`
  function scanMutations(node: LispValue) {
    if (Array.isArray(node)) {
      if (node[0] === 'set!' && typeof node[1] === 'string') {
        mutableVars.add(toRustId(node[1]));
      }
      for (const child of node) {
        scanMutations(child);
      }
    }
  }

  for (const node of nodes) {
    scanMutations(node);
  }

  function formatRustNum(num: number): string {
    const s = String(num);
    return s.includes('.') ? s : `${s}.0`;
  }

  function transpileRustExpr(expr: LispValue, inMain = false): string {
    if (typeof expr === 'number') {
      return formatRustNum(expr);
    }
    if (typeof expr === 'boolean') {
      return expr ? 'true' : 'false';
    }
    if (expr === null) {
      return '()';
    }
    if (typeof expr === 'string') {
      if (expr.startsWith('"') && expr.endsWith('"')) {
        return expr;
      }
      if (expr === 'pi') return 'std::f64::consts::PI';
      if (expr === 'e') return 'std::f64::consts::E';
      if (expr === 'true') return 'true';
      if (expr === 'false') return 'false';
      return toRustId(expr);
    }

    if (!Array.isArray(expr)) {
      return '()';
    }

    if (expr.length === 0) return 'vec![]';

    const op = expr[0];

    // Module imports comment
    if (op === 'import-npm') {
      const pkg = String(expr[1]).replace(/^["']|["']$/g, '');
      const alias = expr[2] === ':as' ? String(expr[3]).replace(/^["']|["']$/g, '') : null;
      return `// [OmniLisp NPM Bridge]: Foreign package '${pkg}'${alias ? ` as '${alias}'` : ''}`;
    }

    if (op === 'import') {
      const targets = expr.slice(1).map(p => String(p).replace(/^["']|["']$/g, ''));
      return `// [OmniLisp Import]: Using module(s) ${targets.join(', ')}`;
    }

    if (op === 'import-scheme' || op === 'import-clojure' || op === 'import-common-lisp') {
      return `// [Dialect Transpiler]: Embedded ${op}`;
    }

    // Variable mutation
    if (op === 'set!') {
      const name = toRustId(String(expr[1]));
      const val = transpileRustExpr(expr[2], inMain);
      return `${name} = ${val}`;
    }

    // Closures / Lambdas
    if (op === 'lambda' || op === 'fn') {
      const paramsRaw = Array.isArray(expr[1]) ? (expr[1] as string[]) : [];
      const params = paramsRaw.map(p => `${toRustId(String(p))}: f64`).join(', ');
      const bodyForms = expr.slice(2);
      if (bodyForms.length === 1) {
        return `|${params}| ${transpileRustExpr(bodyForms[0], inMain)}`;
      }
      const lines = bodyForms.map((b, i) => {
        const compiled = transpileRustExpr(b, inMain);
        return i === bodyForms.length - 1 ? `    ${compiled}` : `    ${compiled};`;
      });
      return `|${params}| {\n${lines.join('\n')}\n}`;
    }

    // Conditionals: if cond { conseq } else { alt }
    if (op === 'if') {
      const cond = transpileRustExpr(expr[1], inMain);
      const conseq = transpileRustExpr(expr[2], inMain);
      const alt = expr[3] !== undefined ? transpileRustExpr(expr[3], inMain) : '()';
      return `if ${cond} { ${conseq} } else { ${alt} }`;
    }

    // Begin / Do blocks
    if (op === 'begin' || op === 'do') {
      const forms = expr.slice(1);
      if (forms.length === 0) return '()';
      if (forms.length === 1) return transpileRustExpr(forms[0], inMain);
      const lines = forms.map((b, i) => {
        const compiled = transpileRustExpr(b, inMain);
        return i === forms.length - 1 ? `    ${compiled}` : `    ${compiled};`;
      });
      return `{\n${lines.join('\n')}\n}`;
    }

    // Arithmetic
    if (['+', '-', '*', '/', '%'].includes(op as string)) {
      if (expr.length === 2 && op === '-') {
        return `(-${transpileRustExpr(expr[1], inMain)})`;
      }
      const args = expr.slice(1).map(e => transpileRustExpr(e, inMain));
      return `(${args.join(` ${op} `)})`;
    }

    // Comparisons
    if (['=', '==', 'eq?', 'equal?'].includes(op as string)) {
      const a = transpileRustExpr(expr[1], inMain);
      const b = transpileRustExpr(expr[2], inMain);
      return `(${a} == ${b})`;
    }
    if (['<', '<=', '>', '>='].includes(op as string)) {
      const a = transpileRustExpr(expr[1], inMain);
      const b = transpileRustExpr(expr[2], inMain);
      return `(${a} ${op} ${b})`;
    }

    // Logic
    if (op === 'and') {
      const args = expr.slice(1).map(e => transpileRustExpr(e, inMain));
      return `(${args.join(' && ')})`;
    }
    if (op === 'or') {
      const args = expr.slice(1).map(e => transpileRustExpr(e, inMain));
      return `(${args.join(' || ')})`;
    }
    if (op === 'not') {
      return `(!${transpileRustExpr(expr[1], inMain)})`;
    }

    // Print -> println!
    if (op === 'print' || op === 'display') {
      const args = expr.slice(1).map(e => transpileRustExpr(e, inMain));
      if (args.length === 0) {
        return `println!()`;
      }
      const formatStr = args.map(() => '{}').join(' ');
      return `println!("${formatStr}", ${args.join(', ')})`;
    }

    // Lists -> Vec
    if (op === 'list') {
      const items = expr.slice(1).map(e => transpileRustExpr(e, inMain));
      return `vec![${items.join(', ')}]`;
    }

    if (op === 'head' || op === 'car') {
      return `${transpileRustExpr(expr[1], inMain)}[0]`;
    }

    if (op === 'tail' || op === 'cdr') {
      return `${transpileRustExpr(expr[1], inMain)}[1..].to_vec()`;
    }

    if (op === 'length') {
      return `(${transpileRustExpr(expr[1], inMain)}.len() as f64)`;
    }

    // Math functions
    const math1: Record<string, string> = {
      sqrt: 'sqrt',
      'native-sqrt': 'sqrt',
      cbrt: 'cbrt',
      sin: 'sin',
      'native-sin': 'sin',
      cos: 'cos',
      'native-cos': 'cos',
      tan: 'tan',
      'native-tan': 'tan',
      abs: 'abs',
      floor: 'floor',
      ceil: 'ceil',
      round: 'round',
      exp: 'exp',
      ln: 'ln',
    };
    if (typeof op === 'string' && math1[op]) {
      const arg = transpileRustExpr(expr[1], inMain);
      return `(${arg}).${math1[op]}()`;
    }

    if (op === 'pow' || op === 'native-pow') {
      const b = transpileRustExpr(expr[1], inMain);
      const e = transpileRustExpr(expr[2], inMain);
      return `(${b}).powf(${e})`;
    }

    if (op === 'min') {
      const a = transpileRustExpr(expr[1], inMain);
      const b = transpileRustExpr(expr[2], inMain);
      return `(${a}).min(${b})`;
    }

    if (op === 'max') {
      const a = transpileRustExpr(expr[1], inMain);
      const b = transpileRustExpr(expr[2], inMain);
      return `(${a}).max(${b})`;
    }

    if (op === 'clamp') {
      const v = transpileRustExpr(expr[1], inMain);
      const low = transpileRustExpr(expr[2], inMain);
      const high = transpileRustExpr(expr[3], inMain);
      return `(${v}).clamp(${low}, ${high})`;
    }

    if (op === 'deg->rad') {
      const deg = transpileRustExpr(expr[1], inMain);
      return `(${deg} * std::f64::consts::PI / 180.0)`;
    }

    if (op === 'rad->deg') {
      const rad = transpileRustExpr(expr[1], inMain);
      return `(${rad} * 180.0 / std::f64::consts::PI)`;
    }

    // Strings
    if (op === 'str-upper' || op === 'native-str-upper') {
      return `(${transpileRustExpr(expr[1], inMain)}).to_uppercase()`;
    }
    if (op === 'str-lower' || op === 'native-str-lower') {
      return `(${transpileRustExpr(expr[1], inMain)}).to_lowercase()`;
    }
    if (op === 'str-trim' || op === 'native-str-trim') {
      return `(${transpileRustExpr(expr[1], inMain)}).trim()`;
    }
    if (op === 'str-len' || op === 'native-str-len') {
      return `(${transpileRustExpr(expr[1], inMain)}.len() as f64)`;
    }

    // Default function call
    if (typeof op === 'string') {
      const fnName = toRustId(op);
      const args = expr.slice(1).map(e => transpileRustExpr(e, inMain));
      return `${fnName}(${args.join(', ')})`;
    }

    // Dynamic invocation
    const callee = transpileRustExpr(op, inMain);
    const args = expr.slice(1).map(e => transpileRustExpr(e, inMain));
    return `(${callee})(${args.join(', ')})`;
  }

  // Top level pass
  for (const node of nodes) {
    if (!node || (Array.isArray(node) && node.length === 0)) continue;

    // Check if it's a top-level function definition: (def name (lambda (args) ...))
    if (Array.isArray(node) && node[0] === 'def') {
      const name = toRustId(String(node[1]));
      const val = node[2];

      if (Array.isArray(val) && (val[0] === 'lambda' || val[0] === 'fn')) {
        const paramsRaw = Array.isArray(val[1]) ? (val[1] as string[]) : [];
        const params = paramsRaw.map(p => `${toRustId(String(p))}: f64`).join(', ');
        const bodyForms = val.slice(2);

        let bodyCode = '';
        if (bodyForms.length === 1) {
          const single = transpileRustExpr(bodyForms[0], false);
          bodyCode = `    ${single}`;
        } else {
          const lines = bodyForms.map((b, i) => {
            const compiled = transpileRustExpr(b, false);
            return i === bodyForms.length - 1 ? `    ${compiled}` : `    ${compiled};`;
          });
          bodyCode = lines.join('\n');
        }

        topLevelFunctions.push(`fn ${name}(${params}) -> f64 {\n${bodyCode}\n}`);
        continue;
      }

      // Top-level variable definition -> put inside fn main()
      const isMut = mutableVars.has(name);
      const mutPrefix = isMut ? 'mut ' : '';
      const valCode = transpileRustExpr(val, true);
      mainStatements.push(`    let ${mutPrefix}${name} = ${valCode};`);
      continue;
    }

    // Expression statement
    const exprCode = transpileRustExpr(node, true);
    if (exprCode) {
      if (exprCode.startsWith('//')) {
        mainStatements.push(`    ${exprCode}`);
      } else {
        mainStatements.push(`    ${exprCode};`);
      }
    }
  }

  const sections: string[] = [];

  if (includeCargoComment) {
    sections.push(
      `// ==========================================================================\n` +
      `// Auto-generated Rust Source Code\n` +
      `// Compiled from OmniLisp VM AST\n` +
      `// Target: Rust 2021 / 2024 Edition (cargo run)\n` +
      `// ==========================================================================`
    );
  }

  sections.push(
    `#[allow(unused_variables, unused_mut, dead_code, unused_parens)]`
  );

  if (topLevelFunctions.length > 0) {
    sections.push(topLevelFunctions.join('\n\n'));
  }

  sections.push(
    `fn main() {\n` +
    (mainStatements.length > 0 ? mainStatements.join('\n') : `    println!("OmniLisp program initialized");`) +
    `\n}`
  );

  return sections.join('\n\n');
}
