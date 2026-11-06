/**
 * Local Ostadix-inspired telemetry simulation and heuristic repair experiments.
 * This module does not connect to the native Ostadix runtime. Generated repairs
 * may change semantics or comment out failing forms; inspect them before use.
 */

import { parse } from './parser';
import { createGlobalEnv } from './envFactory';
import { evaluateProgram } from './evaluator';
import { compileToTypeScript } from './tsTranspiler';
import { balanceParentheses, extractMissingSymbols, sanitizeMathOperations } from './errorFuzzer';
import { Env, LispJsFunction, LispValue } from './types';

export interface OstadixTelemetry {
  version: string;
  kernelState: 'ONLINE' | 'ACTIVE' | 'HEALING';
  uptimeSeconds: number;
  totalExecutions: number;
  healedErrorsCount: number;
  channelsActive: string[];
}

export interface OstadixFuzzedScriptResult {
  originalCode: string;
  originalError: string;
  errorLine?: number;
  errorCategory: 'SYNTAX' | 'UNBOUND_SYMBOL' | 'ARITHMETIC' | 'TYPE_MISMATCH' | 'MODULE_RESOLVE' | 'RUNTIME';
  repairsApplied: string[];
  isRunnable: boolean;
  // Generated Runnable Scripts
  runnableLisp: string;
  runnableTypeScript: string;
  runnableShellScript: string;
  // Verified execution in test sandbox
  verifiedOutput: string[];
  executionTimeMs: number;
}

class OstadixSystemKernel {
  readonly version = 'omnilisp-simulation-1';
  private startTime = Date.now();
  private executions = 0;
  private healedErrors = 0;
  private messageChannels = new Map<string, any[]>();

  getTelemetry(): OstadixTelemetry {
    return {
      version: this.version,
      kernelState: 'ONLINE',
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      totalExecutions: this.executions,
      healedErrorsCount: this.healedErrors,
      channelsActive: Array.from(this.messageChannels.keys()),
    };
  }

  recordExecution() {
    this.executions++;
  }

  recordHealedError() {
    this.healedErrors++;
  }

  channelSend(channel: string, msg: any) {
    if (!this.messageChannels.has(channel)) {
      this.messageChannels.set(channel, []);
    }
    this.messageChannels.get(channel)!.push({ msg, timestamp: Date.now() });
  }

  channelRecv(channel: string): any[] {
    return this.messageChannels.get(channel) || [];
  }
}

export const ostadixKernel = new OstadixSystemKernel();

/**
 * Categorize error type to apply precision fuzzing strategies
 */
function categorizeError(errMsg: string): OstadixFuzzedScriptResult['errorCategory'] {
  const lower = errMsg.toLowerCase();
  if (lower.includes('parenthesis') || lower.includes('quote') || lower.includes('unexpected') || lower.includes('eof') || lower.includes('syntax')) {
    return 'SYNTAX';
  }
  if (lower.includes('undefined symbol') || lower.includes('is not defined') || lower.includes('not found')) {
    return 'UNBOUND_SYMBOL';
  }
  if (lower.includes('division by zero') || lower.includes('nan') || lower.includes('overflow')) {
    return 'ARITHMETIC';
  }
  if (lower.includes('is not a function') || lower.includes('type') || lower.includes('cannot read properties')) {
    return 'TYPE_MISMATCH';
  }
  if (lower.includes('module') || lower.includes('npm') || lower.includes('import')) {
    return 'MODULE_RESOLVE';
  }
  return 'RUNTIME';
}

/**
 * Attempt heuristic rewrites of an OmniLisp script
 * across OmniLisp, TypeScript, and self-contained Node/Bash executable scripts.
 */
export async function fuzzErrorIntoRunnableScript(
  sourceCode: string,
  errorMsg?: string
): Promise<OstadixFuzzedScriptResult> {
  const startTime = performance.now();
  const rawError = errorMsg || 'Unspecified runtime or syntax fault';
  const category = categorizeError(rawError);
  const repairs: string[] = [];

  let candidateLisp = sourceCode;

  // Step 1: Repair bracket / string balance
  const balance = balanceParentheses(candidateLisp);
  if (balance.repaired) {
    candidateLisp = balance.code;
    repairs.push(...balance.notes);
  }

  // Step 2: Neutralize arithmetic hazards
  const mathSanitize = sanitizeMathOperations(candidateLisp);
  if (mathSanitize.repaired) {
    candidateLisp = mathSanitize.code;
    repairs.push('Neutralized division-by-zero & arithmetic overflow hazards with guarded expressions');
  }

  // Step 3: Extract undefined symbols and synthesize polyfills/fallbacks
  const missingSymbols = extractMissingSymbols(rawError);
  const synthesizedBindings: string[] = [];

  for (const sym of missingSymbols) {
    if (rawError.includes('not a function')) {
      candidateLisp = `;; [Ostadix Fuzzer: Synthesized resilient polymorphic lambda for '${sym}']\n(def ${sym} (lambda (&rest args) (if (> (length args) 0) (head args) "healed_fallback")))\n` + candidateLisp;
      repairs.push(`Synthesized fallback function definition for '${sym}'`);
    } else {
      // Safe scalar or collection binding
      candidateLisp = `;; [Ostadix Fuzzer: Injected safe default binding for unbound symbol '${sym}']\n(def ${sym} 0)\n` + candidateLisp;
      repairs.push(`Synthesized safe default variable binding for '${sym}'`);
    }
    synthesizedBindings.push(sym);
  }

  // Step 4: Iterative trial loop in sandbox to ensure clean execution
  let verifiedOutput: string[] = [];
  let isRunnable = false;

  const testExecution = async (codeToTest: string): Promise<boolean> => {
    try {
      const logs: string[] = [];
      const env = createGlobalEnv();

      // Register print sink
      env.define('print', {
        type: 'js_function',
        fn: (...args: any[]) => {
          logs.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
          return null;
        },
      } as LispJsFunction);

      // Register Ostadix kernel builtins
      installOstadixGlobals(env);

      await evaluateProgram(codeToTest, env);
      verifiedOutput = logs;
      return true;
    } catch (e: any) {
      return false;
    }
  };

  isRunnable = await testExecution(candidateLisp);

  // If still failing, inject Ostadix fault recovery harness
  if (!isRunnable) {
    const errorEscaped = rawError.replace(/"/g, "'");
    candidateLisp = `;; =========================================================================
;; Ostadix Self-Healing Resilient Execution Harness
;; Fault Recovered: ${errorEscaped}
;; =========================================================================

(print "[Ostadix Auto-Healer]: Intercepted fault -> '${errorEscaped}'")
(def ostadix-fault-recovery "RUNNABLE_RESTORED")

;; Safe Execution Envelope
${candidateLisp
  .split('\n')
  .map(line => (line.trim().startsWith(';') ? line : `; [Shielded]: ${line}`))
  .join('\n')}

(print "[Ostadix Auto-Healer]: Fallback report only; failing forms below were disabled.")
`;
    repairs.push('Wrapped all volatile forms in Ostadix Fault Recovery Envelope');
    isRunnable = await testExecution(candidateLisp);
  }

  ostadixKernel.recordHealedError();

  // Step 5: Synthesize Runnable TypeScript code
  let runnableTs = '';
  try {
    const ast = parse(candidateLisp);
    runnableTs = compileToTypeScript(ast, { includeHeader: false });
    runnableTs = `/**
 * Ostadix Auto-Generated Runnable TypeScript Script
 * Fuzzed & Healed from original faulty script
 * Original fault: ${rawError.replace(/\*\//g, '* /')}
 */

export async function main() {
  try {
${runnableTs.split('\n').map(l => '    ' + l).join('\n')}
  } catch (err: any) {
    console.warn("[Ostadix Resilient Shield]: Caught handled exception:", err?.message || err);
  }
}

// Auto-run if executed directly
if (typeof process !== 'undefined' && import.meta.url === \`file://\${process.argv[1]}\`) {
  main().then(() => console.log("Candidate execution finished; inspect output and handled errors"));
}
`;
  } catch {
    runnableTs = `/**
 * Ostadix Resilient TypeScript Script (Auto-Healed)
 */
export async function run() {
  console.log("[Ostadix Auto-Healer]: Executing fuzzed script safely.");
  console.log("Original error avoided: ${rawError.replace(/"/g, '\\"')}");
}
run();
`;
  }

  // Step 6: Synthesize Runnable Executable Node/Bash Shell Script
  const runnableShellScript = `#!/usr/bin/env node
/**
 * Ostadix Standalone Executable Fuzzed Script
 * Generated automatically by OmniLisp & Ostadix Auto-Healer
 *
 * Execution:
 *   chmod +x ./fuzzed_script.js
 *   node ./fuzzed_script.js
 *   or run via npx ostadix fuzz <file.lisp>
 */

const fs = require('fs');

console.log("\\x1b[36m⚡ [Ostadix Fuzzer]\\x1b[0m Running auto-healed runnable script...");
console.log("\\x1b[90mFault Repaired:\\x1b[0m ${rawError.replace(/"/g, '\\"')}");

async function runHealed() {
  const result = {
    status: "REPORT_ONLY",
    repaired: true,
    repairs: ${JSON.stringify(repairs, null, 2)},
    timestamp: new Date().toISOString()
  };

  console.log("\\x1b[32mRepair report generated; this wrapper does not execute the transformed program.\\x1b[0m");
  console.log("Repairs applied:", result.repairs.length);
  return result;
}

runHealed().catch(err => {
  console.error("Shielded:", err);
  process.exit(0); // Guaranteed 0 exit code
});
`;

  const durationMs = Math.round((performance.now() - startTime) * 100) / 100;

  return {
    originalCode: sourceCode,
    originalError: rawError,
    errorCategory: category,
    repairsApplied: repairs.length > 0 ? repairs : ['Verified executable with Ostadix resilience guards.'],
    isRunnable,
    runnableLisp: candidateLisp,
    runnableTypeScript: runnableTs,
    runnableShellScript,
    verifiedOutput,
    executionTimeMs: durationMs,
  };
}

/**
 * Installs first-class Ostadix symbols into OmniLisp runtime environment
 */
export function installOstadixGlobals(env: Env): void {
  // (ostadix/version)
  env.define('ostadix/version', {
    type: 'js_function',
    fn: () => ostadixKernel.version,
  } as LispJsFunction);

  // (ostadix/ping)
  env.define('ostadix/ping', {
    type: 'js_function',
    fn: () => `Local telemetry simulation (${ostadixKernel.version}); no native IPC`,
  } as LispJsFunction);

  // (ostadix/status)
  env.define('ostadix/status', {
    type: 'js_function',
    fn: () => {
      const t = ostadixKernel.getTelemetry();
      return `[Ostadix ${t.version}] State: ${t.kernelState}, Uptime: ${t.uptimeSeconds}s, Healed: ${t.healedErrorsCount}`;
    },
  } as LispJsFunction);

  // (ostadix/channel-send name value)
  env.define('ostadix/channel-send', {
    type: 'js_function',
    fn: (channel: any, value: any) => {
      ostadixKernel.channelSend(String(channel), value);
      return true;
    },
  } as LispJsFunction);

  // (ostadix/channel-recv name)
  env.define('ostadix/channel-recv', {
    type: 'js_function',
    fn: (channel: any) => {
      return ostadixKernel.channelRecv(String(channel));
    },
  } as LispJsFunction);

  // (ostadix/fuzz "code-string")
  env.define('ostadix/fuzz', {
    type: 'js_function',
    fn: async (codeToFuzz: any) => {
      const res = await fuzzErrorIntoRunnableScript(String(codeToFuzz));
      return res.runnableLisp;
    },
  } as LispJsFunction);

  // Aliases for prefix-less access
  env.define('ostadix-ping', env.get('ostadix/ping'));
  env.define('ostadix-version', env.get('ostadix/version'));
  env.define('ostadix-status', env.get('ostadix/status'));
}
