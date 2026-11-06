/**
 * OmniLisp SDK & Library Entry Point
 * Can be installed via npm (npm i omnilisp) and imported into TypeScript/JavaScript projects.
 */

export { parse, parseToken } from './lisp/parser';
export { evaluate, evaluateProgram } from './lisp/evaluator';
export { createGlobalEnv } from './lisp/envFactory';
export { compileToTypeScript, convertTypeScriptToOmniLisp } from './lisp/tsTranspiler';
export { compileToRust } from './lisp/rustTranspiler';
export { compileToJS, compileToWAT } from './lisp/compiler';
export { moduleManager } from './lisp/modules';
export type { LispModule } from './lisp/modules';
export { npmManager, POPULAR_NPM_PACKAGES } from './lisp/npmLoader';
export { convertDialectToOmniLisp, detectDialect } from './lisp/converter';
export { Env } from './lisp/types';
export type { LispValue, LispLambda, LispJsFunction, DebugContext, DebugFrame } from './lisp/types';
export { ostadixKernel, fuzzErrorIntoRunnableScript, installOstadixGlobals } from './lisp/ostadix';
export type { OstadixTelemetry, OstadixFuzzedScriptResult } from './lisp/ostadix';

/**
 * Convenient one-shot execution function for Node.js or browser
 */
export async function runLisp(code: string): Promise<{ result: any; output: string[] }> {
  const { createGlobalEnv } = await import('./lisp/envFactory');
  const { evaluateProgram } = await import('./lisp/evaluator');

  const logs: string[] = [];
  const env = createGlobalEnv();

  env.define('print', {
    type: 'js_function',
    fn: (...args: any[]) => {
      const line = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      logs.push(line);
      return null;
    },
  });

  const result = await evaluateProgram(code, env);
  return { result, output: logs };
}
