import { Env, LispJsFunction, LispValue } from './types';
import { parse } from './parser';
import { installOstadixGlobals } from './ostadix';

export function createGlobalEnv(): Env {
  const env = new Env();

  const defineJsFn = (name: string, fn: (...args: any[]) => any) => {
    env.define(name, { type: 'js_function', fn } as LispJsFunction);
  };

  // Math & Operators
  defineJsFn('+', (...args) => args.reduce((a, b) => a + b, 0));
  defineJsFn('-', (...args) => args.length === 1 ? -args[0] : args.reduce((a, b) => a - b));
  defineJsFn('*', (...args) => args.reduce((a, b) => a * b, 1));
  defineJsFn('/', (...args) => args.reduce((a, b) => a / b));
  defineJsFn('>', (a, b) => a > b);
  defineJsFn('<', (a, b) => a < b);
  defineJsFn('>=', (a, b) => a >= b);
  defineJsFn('<=', (a, b) => a <= b);
  defineJsFn('=', (a, b) => {
    if (Array.isArray(a) && Array.isArray(b)) {
      return JSON.stringify(a) === JSON.stringify(b);
    }
    return a === b;
  });
  defineJsFn('%', (a, b) => a % b);
  defineJsFn('not', a => !a);
  defineJsFn('and', (...args) => args.every(Boolean));
  defineJsFn('or', (...args) => args.some(Boolean));

  // Strings & Types
  defineJsFn('str-concat', (...args) =>
    args.map(a => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a))).join('')
  );
  defineJsFn('null?', a => a === null || (Array.isArray(a) && a.length === 0));
  defineJsFn('list?', a => Array.isArray(a));
  defineJsFn('number?', a => typeof a === 'number');
  defineJsFn('string?', a => typeof a === 'string');

  // Lists
  defineJsFn('list', (...args) => args);
  defineJsFn('cons', (x, list) => {
    if (!Array.isArray(list)) throw new Error('cons expects a list as second argument');
    return [x, ...list];
  });
  defineJsFn('car', list => (Array.isArray(list) ? list[0] : null));
  defineJsFn('cdr', list => (Array.isArray(list) ? list.slice(1) : []));
  defineJsFn('map', (fn: any, list: any[]) => {
     if(!Array.isArray(list)) throw new Error('map expects a list');
     return list.map(item => {
        if(fn.type === 'js_function') return fn.fn(item);
        // Evaluating lambda natively requires evaluator access, which is tricky inside
        // a pure JS function without circular deps. For simpler OmniLisp,
        // we'll stick to a basic mapping implementation or inject the evaluator.
        throw new Error("Lisp lambdas in map require evaluator context (use custom native map in future)");
     });
  });
  defineJsFn('length', a => (Array.isArray(a) || typeof a === 'string' ? a.length : 0));

  // I/O
  defineJsFn('print', (...args) => {
     const output = args.map(a => typeof a === 'object' && a !== null && !(a instanceof Array) && 'type' in a ? `<${a.type}>` : JSON.stringify(a)).join(' ');
     return output;
  });

  // Native Math Primitives
  defineJsFn('native-sqrt', Math.sqrt);
  defineJsFn('native-cbrt', Math.cbrt);
  defineJsFn('native-pow', (b: number, e: number) => Math.pow(b, e));
  defineJsFn('native-sin', Math.sin);
  defineJsFn('native-cos', Math.cos);
  defineJsFn('native-tan', Math.tan);
  defineJsFn('native-asin', Math.asin);
  defineJsFn('native-acos', Math.acos);
  defineJsFn('native-atan', Math.atan);
  defineJsFn('native-round', Math.round);
  defineJsFn('native-floor', Math.floor);
  defineJsFn('native-ceil', Math.ceil);
  defineJsFn('native-random', Math.random);

  // Native String Primitives
  defineJsFn('native-str-len', (s: string) => (typeof s === 'string' ? s.length : String(s).length));
  defineJsFn('native-str-upper', (s: string) => String(s).toUpperCase());
  defineJsFn('native-str-lower', (s: string) => String(s).toLowerCase());
  defineJsFn('native-str-trim', (s: string) => String(s).trim());
  defineJsFn('native-str-slice', (s: string, a: number, b?: number) => String(s).slice(a, b));
  defineJsFn('native-str->num', (s: string) => Number(s));

  // Polyglot: Run other languages (Simulated via JS interop)
  const execJs = (code: string) => {
    try {
      return new Function('return (' + code + ')')();
    } catch {
      return new Function(code)();
    }
  };
  defineJsFn('run-js', execJs);
  defineJsFn('javascript', execJs);

  // Install Ostadix Core Engine Globals & Error Fuzzer
  installOstadixGlobals(env);

  return env;
}
