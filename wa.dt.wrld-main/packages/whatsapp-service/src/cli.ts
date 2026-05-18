#!/usr/bin/env node
/**
 * azizi-wa — WhatsApp Service CLI
 *
 * Subcommand-based CLI for the WhatsApp bot service. Start the server,
 * manage users/tags, search RAG, detect intents, or check dependencies —
 * all from the command line. Every subcommand supports --json for AI agent
 * consumption.
 *
 * Usage:
 *   node dist/cli.js                                       # Start server (default)
 *   node dist/cli.js info --json                            # Machine-readable reference
 *   node dist/cli.js user:list --json                       # List all users
 *   node dist/cli.js rag:search "crop insurance" --json     # Semantic search
 *   node dist/cli.js check --json                           # Dep connectivity
 *   node dist/cli.js --help                                 # Full reference
 */

import { parseArgs } from 'node:util';
import * as net from 'node:net';

import {
  SERVER_NAME, SERVER_VERSION, SERVER_DESCRIPTION, DEFAULT_PORT,
  FEATURE_FLAGS, ROUTES, DEPENDENCIES, MODE_PRESETS, COMMANDS,
} from './server_meta';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CliArgs {
  help: boolean;
  json: boolean;
  verbose: boolean;
  port?: number;
  mode?: string;
  enable: string[];
  disable: string[];
  whatsappUrl?: string;
  mongoUri?: string;
  // Subcommand
  command: string;
  positional: string[];
  // Specific flags
  tag?: string;
  key?: string;
  value?: string;
  prefix?: string;
  query?: string;
  collection?: string;
  limit?: number;
  identifier?: string;
  name?: string;
  tags?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseCli(): CliArgs {
  const { values, positionals } = parseArgs({
    options: {
      help: { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      verbose: { type: 'boolean', default: false },
      port: { type: 'string' },
      mode: { type: 'string' },
      enable: { type: 'string', multiple: true, default: [] },
      disable: { type: 'string', multiple: true, default: [] },
      'whatsapp-url': { type: 'string' },
      'mongo-uri': { type: 'string' },
      // Specific flags
      tag: { type: 'string' },
      key: { type: 'string' },
      value: { type: 'string' },
      prefix: { type: 'string' },
      collection: { type: 'string' },
      limit: { type: 'string' },
      identifier: { type: 'string' },
      name: { type: 'string' },
      tags: { type: 'string' },
      message: { type: 'string' },
    },
    allowPositionals: true,
    strict: false,
  });

  const command = positionals[0] || '';
  const positionalArgs = positionals.slice(1);

  return {
    help: values.help as boolean,
    json: values.json as boolean,
    verbose: values.verbose as boolean,
    port: values.port ? parseInt(values.port as string, 10) : undefined,
    mode: values.mode as string | undefined,
    enable: (values.enable || []) as string[],
    disable: (values.disable || []) as string[],
    whatsappUrl: values['whatsapp-url'] as string | undefined,
    mongoUri: values['mongo-uri'] as string | undefined,
    command,
    positional: positionalArgs,
    tag: values.tag as string | undefined,
    key: values.key as string | undefined,
    value: values.value as string | undefined,
    prefix: values.prefix as string | undefined,
    collection: values.collection as string | undefined,
    limit: values.limit ? parseInt(values.limit as string, 10) : undefined,
    identifier: values.identifier as string | undefined,
    name: values.name as string | undefined,
    tags: values.tags as string | undefined,
    message: values.message as string | undefined,
  };
}

// ---------------------------------------------------------------------------
// Env override
// ---------------------------------------------------------------------------

function inferMode(): string {
  const env = process.env.NODE_ENV || 'development';
  return { development: 'dev', test: 'test', production: 'prod' }[env] || 'dev';
}

function applyArgs(args: CliArgs): void {
  const mode = args.mode || inferMode();
  process.env._CLI_MODE = mode;

  const preset = MODE_PRESETS[mode] || {};
  for (const [key, value] of Object.entries(preset)) {
    if (!(key in process.env) || process.env[key] === '') {
      process.env[key] = value;
    }
  }

  const flagMap = new Map(FEATURE_FLAGS.map(f => [f.name, f]));
  for (const name of args.enable) {
    const f = flagMap.get(name.toUpperCase());
    if (f) {
      process.env[f.env] = 'true';
    } else {
      process.stderr.write(`[warn] Unknown feature ${name} -- ignored\n`);
    }
  }
  for (const name of args.disable) {
    const f = flagMap.get(name.toUpperCase());
    if (f) {
      process.env[f.env] = 'false';
    } else {
      process.stderr.write(`[warn] Unknown feature ${name} -- ignored\n`);
    }
  }

  if (args.port) process.env.PORT = String(args.port);
  if (args.whatsappUrl) process.env.WHATSAPP_API_URL = args.whatsappUrl;
  if (args.mongoUri) process.env.MONGODB_URI = args.mongoUri;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flagStatus(f: { env: string; defaultValue: string }): string {
  const val = process.env[f.env] ?? f.defaultValue;
  return val === 'true' ? '[+]' : '[-]';
}

function checkTcp(host: string, port: number, timeout = 500): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(timeout);
    sock.once('connect', () => { sock.destroy(); resolve(true); });
    sock.once('error', () => { sock.destroy(); resolve(false); });
    sock.once('timeout', () => { sock.destroy(); resolve(false); });
    sock.connect(port, host);
  });
}

async function depCheck(d: { name: string; env: string; required: boolean }): Promise<Record<string, unknown>> {
  const url = process.env[d.env] || '';
  if (!url) {
    return { name: d.name, status: 'not_configured', required: d.required };
  }
  if (d.env.includes('KEY') || d.env.includes('TOKEN') || d.env.includes('SECRET')) {
    return { name: d.name, status: 'configured', required: d.required };
  }
  try {
    const parsed = new URL(url);
    if (parsed.hostname) {
      const p = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'https:' ? 443 : 80);
      const ok = await checkTcp(parsed.hostname, p);
      return {
        name: d.name,
        status: ok ? 'ok' : 'unreachable',
        url: `${parsed.protocol}//${parsed.hostname}:${p}`,
        required: d.required,
      };
    }
  } catch {
    // Not a URL (e.g., mongodb:// connection string)
  }
  return { name: d.name, status: 'configured', required: d.required };
}

function output(data: unknown, asJson: boolean, ok = true): number {
  if (asJson) {
    console.log(JSON.stringify({ ok, data }));
  } else {
    if (typeof data === 'string') {
      console.log(data);
    } else if (Array.isArray(data)) {
      for (const item of data) {
        console.log(typeof item === 'string' ? `  ${item}` : `  ${JSON.stringify(item)}`);
      }
    } else if (data && typeof data === 'object') {
      for (const [k, v] of Object.entries(data)) {
        console.log(`  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
      }
    }
  }
  return ok ? 0 : 1;
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------

function cmd_serve(_args: CliArgs): number {
  applyArgs(_args);
  // require('./index') triggers startServer() and the entire boot sequence
  require('./index');
  return 0;
}

function cmd_info(args: CliArgs): number {
  const data = {
    name: SERVER_NAME,
    version: SERVER_VERSION,
    description: SERVER_DESCRIPTION,
    default_port: DEFAULT_PORT,
    routes: ROUTES,
    feature_flags: FEATURE_FLAGS.map(f => ({ ...f, current: flagStatus(f) })),
    dependencies: DEPENDENCIES,
    commands: COMMANDS,
    mode_presets: MODE_PRESETS,
  };

  if (args.json) {
    return output(data, true);
  }

  // Text output (full --help reference)
  const mode = inferMode();
  console.log(`${SERVER_NAME} v${SERVER_VERSION}`);
  console.log(SERVER_DESCRIPTION);
  console.log();
  console.log('COMMANDS');
  for (const cmd of COMMANDS) {
    const def = cmd.is_default ? '  (default)' : '';
    console.log(`  ${cmd.name.padEnd(22)} ${cmd.description}${def}`);
  }
  console.log();
  console.log('GLOBAL FLAGS');
  console.log(`  --port INT              Listening port  [default: ${DEFAULT_PORT}]`);
  console.log(`  --mode MODE             Preset: dev|test|eval|prod  [default: ${mode}]`);
  console.log('  --enable FEATURE        Enable a feature flag (repeatable)');
  console.log('  --disable FEATURE       Disable a feature flag (repeatable)');
  console.log('  --json                  Machine-readable JSON output');
  console.log('  --help                  Print this reference and exit');
  console.log();
  console.log('USER FLAGS');
  console.log('  --identifier PHONE      Phone number (e.g., 254722833440)');
  console.log('  --name NAME             User display name');
  console.log('  --tags TAG1,TAG2        Comma-separated tags');
  console.log();
  console.log('TAG FLAGS');
  console.log('  --tag NAME              Tag name');
  console.log();
  console.log('RAG FLAGS');
  console.log('  --collection NAME       Qdrant collection name');
  console.log('  --limit N               Max results');
  console.log();
  console.log('CONFIG FLAGS');
  console.log('  --key KEY               Config key');
  console.log('  --value VALUE           Config value');
  console.log('  --prefix PREFIX         Config key prefix for listing');
  console.log();
  console.log('FEATURE FLAGS');
  for (const f of FEATURE_FLAGS) {
    console.log(`  ${flagStatus(f)} ${f.name.padEnd(22)} ${f.description}  [env: ${f.env}]`);
  }
  console.log();
  console.log('DEPENDENCIES');
  for (const d of DEPENDENCIES) {
    const req = d.required ? 'required' : 'optional';
    const configured = process.env[d.env] ? '[configured]' : '[not set]';
    console.log(`  ${d.name.padEnd(22)} [env: ${d.env}]  ${req}  ${configured}`);
  }
  console.log();

  const tags: string[] = [];
  for (const r of ROUTES) {
    if (!tags.includes(r.tag)) tags.push(r.tag);
  }
  console.log(`ROUTES (${ROUTES.length} registered)`);
  for (const tag of tags) {
    console.log(`  [${tag}]`);
    for (const r of ROUTES) {
      if (r.tag === tag) {
        const authNote = r.auth !== 'api_key' ? `  [${r.auth}]` : '';
        console.log(`    ${r.method.padEnd(7)} ${r.path.padEnd(45)} ${r.description}${authNote}`);
      }
    }
  }
  console.log();
  console.log('MODES');
  console.log('  dev   LLM=on  QDRANT=off  QUEUE=off  AUTH=off  SPAO=on');
  console.log('  test  All features off (CI, no external deps)');
  console.log('  eval  LLM=on  QDRANT=on   QUEUE=off  AUTH=off  SPAO=on');
  console.log('  prod  All features on (inferred from NODE_ENV=production)');
  console.log();
  console.log('RECIPES');
  console.log(`  ${SERVER_NAME} serve --mode dev                     # Local dev`);
  console.log(`  ${SERVER_NAME} info --json | jq '.routes[].path'    # List routes`);
  console.log(`  ${SERVER_NAME} check --json                         # Dep connectivity`);
  console.log(`  ${SERVER_NAME} user:list --json                     # List all users`);
  console.log(`  ${SERVER_NAME} user:get --identifier 254722833440   # Get user`);
  console.log(`  ${SERVER_NAME} tag:list --json                      # List tag configs`);
  console.log(`  ${SERVER_NAME} rag:search "crop insurance" --json   # RAG search`);
  console.log(`  ${SERVER_NAME} config:list --prefix tag_config_     # List tag configs`);
  return 0;
}

async function cmd_check(args: CliArgs): Promise<number> {
  const checks = await Promise.all(DEPENDENCIES.map(d => depCheck(d)));
  const results: Record<string, Record<string, unknown>> = {};
  for (const check of checks) {
    results[check.name as string] = check;
  }
  if (args.json) {
    return output(results, true);
  }
  for (const [name, info] of Object.entries(results)) {
    const sym: Record<string, string> = { ok: '[ok]', configured: '[ok]', not_configured: '[--]', unreachable: '[!!]' };
    const status = info.status as string;
    console.log(`  ${(sym[status] || '[??]')} ${name.padEnd(22)} ${(info.url as string) || status}`);
  }
  const allOk = Object.values(results).every(
    info => ['ok', 'configured', 'not_configured'].includes(info.status as string)
  );
  return allOk ? 0 : 1;
}

async function cmd_user_list(args: CliArgs): Promise<number> {
  applyArgs(args);
  const { stateManager } = await import('./utils/stateManager');
  await stateManager.init();
  const users = await stateManager.getUsers();
  return output(users, args.json);
}

async function cmd_user_get(args: CliArgs): Promise<number> {
  const identifier = args.identifier || args.positional[0];
  if (!identifier) {
    process.stderr.write(`Usage: ${SERVER_NAME} user:get --identifier PHONE\n`);
    return 1;
  }
  applyArgs(args);
  const { stateManager } = await import('./utils/stateManager');
  await stateManager.init();
  const user = await stateManager.getUser(identifier);
  if (!user) {
    return output({ error: `User '${identifier}' not found` }, args.json, false);
  }
  return output(user, args.json);
}

async function cmd_user_register(args: CliArgs): Promise<number> {
  const identifier = args.identifier || args.positional[0];
  if (!identifier) {
    process.stderr.write(`Usage: ${SERVER_NAME} user:register --identifier PHONE [--name NAME] [--tags TAG1,TAG2]\n`);
    return 1;
  }
  applyArgs(args);
  const { stateManager } = await import('./utils/stateManager');
  await stateManager.init();
  const tagList = args.tags ? args.tags.split(',').map(t => t.trim()) : [];
  const user = await stateManager.registerUser(identifier, 'c.us' as 'c.us', {
    name: args.name,
    tags: tagList,
  });
  return output(user, args.json);
}

async function cmd_tag_list(args: CliArgs): Promise<number> {
  applyArgs(args);
  const { stateManager } = await import('./utils/stateManager');
  await stateManager.init();
  const { eventRouter } = await import('./services/eventRouter');
  const configs = await eventRouter.getAllTagConfigurations();
  return output(configs, args.json);
}

async function cmd_tag_get(args: CliArgs): Promise<number> {
  const tag = args.tag || args.positional[0];
  if (!tag) {
    process.stderr.write(`Usage: ${SERVER_NAME} tag:get --tag NAME\n`);
    return 1;
  }
  applyArgs(args);
  const { stateManager } = await import('./utils/stateManager');
  await stateManager.init();
  const { eventRouter } = await import('./services/eventRouter');
  const configs = await eventRouter.getTagConfigurations([tag]);
  if (configs.length === 0) {
    return output({ error: `Tag '${tag}' not found or disabled` }, args.json, false);
  }
  return output(configs[0], args.json);
}

async function cmd_rag_search(args: CliArgs): Promise<number> {
  const query = args.positional.join(' ') || args.message;
  if (!query) {
    process.stderr.write(`Usage: ${SERVER_NAME} rag:search "QUERY" [--collection NAME] [--limit N]\n`);
    return 1;
  }
  applyArgs(args);
  const { qdrantHandler } = await import('./services/qdrantHandler');
  const results = await qdrantHandler.hybridSearch(
    { query, identifier: args.identifier || 'cli', limit: args.limit || 5 },
    args.collection || 'documents',
  );
  return output(results, args.json);
}

async function cmd_intent_detect(args: CliArgs): Promise<number> {
  const message = args.positional.join(' ') || args.message;
  if (!message) {
    process.stderr.write(`Usage: ${SERVER_NAME} intent:detect "MESSAGE"\n`);
    return 1;
  }
  applyArgs(args);
  const { llmService } = await import('./services/llmService');
  const result = await llmService.detectIntent(message, []);
  return output(result, args.json);
}

async function cmd_config_get(args: CliArgs): Promise<number> {
  const key = args.key || args.positional[0];
  if (!key) {
    process.stderr.write(`Usage: ${SERVER_NAME} config:get --key KEY\n`);
    return 1;
  }
  applyArgs(args);
  const { stateManager } = await import('./utils/stateManager');
  await stateManager.init();
  const value = await stateManager.getConfig(key);
  if (value === undefined) {
    return output({ error: `Config key '${key}' not found` }, args.json, false);
  }
  return output({ key, value }, args.json);
}

async function cmd_config_set(args: CliArgs): Promise<number> {
  const key = args.key || args.positional[0];
  const value = args.value || args.positional[1];
  if (!key || value === undefined) {
    process.stderr.write(`Usage: ${SERVER_NAME} config:set --key KEY --value VALUE\n`);
    return 1;
  }
  applyArgs(args);
  const { stateManager } = await import('./utils/stateManager');
  await stateManager.init();
  // Try to parse as JSON, fall back to string
  let parsed: unknown = value;
  try {
    parsed = JSON.parse(value);
  } catch {
    // Keep as string
  }
  await stateManager.setConfig(key, parsed as string | number | boolean | null | unknown[] | Record<string, unknown>);
  return output({ key, value: parsed, status: 'set' }, args.json);
}

async function cmd_config_list(args: CliArgs): Promise<number> {
  const prefix = args.prefix || args.positional[0] || '';
  if (!prefix) {
    process.stderr.write(`Usage: ${SERVER_NAME} config:list --prefix PREFIX\n`);
    return 1;
  }
  applyArgs(args);
  const { stateManager } = await import('./utils/stateManager');
  await stateManager.init();
  const configs = await stateManager.getConfigsByPrefix(prefix);
  return output(configs, args.json);
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

type CommandHandler = (args: CliArgs) => number | Promise<number>;

const COMMAND_DISPATCH: Record<string, CommandHandler> = {
  'serve': cmd_serve,
  'info': cmd_info,
  'check': cmd_check,
  'user:list': cmd_user_list,
  'user:get': cmd_user_get,
  'user:register': cmd_user_register,
  'tag:list': cmd_tag_list,
  'tag:get': cmd_tag_get,
  'rag:search': cmd_rag_search,
  'intent:detect': cmd_intent_detect,
  'config:get': cmd_config_get,
  'config:set': cmd_config_set,
  'config:list': cmd_config_list,
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseCli();

  if (args.help) {
    cmd_info(args);
    process.exit(0);
  }

  const command = args.command || 'serve';
  const handler = COMMAND_DISPATCH[command];

  if (!handler) {
    process.stderr.write(`Unknown command: ${command}\n`);
    process.stderr.write(`Available: ${Object.keys(COMMAND_DISPATCH).join(', ')}\n`);
    process.exit(1);
  }

  const exitCode = await handler(args);
  if (command !== 'serve') {
    process.exit(exitCode);
  }
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err.message || err}\n`);
  process.exit(1);
});
