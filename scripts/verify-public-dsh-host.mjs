import { spawn } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const packageManifest = JSON.parse(await readFile(join(repoRoot, 'packages/dsh-tui/package.json'), 'utf8'))
const archive = join(repoRoot, 'packages', `lk251066-dsh-tui-${packageManifest.version}.tgz`)
const testRoot = resolve(repoRoot, process.env.DSH_PUBLIC_SMOKE_ROOT ?? '.test-results/public-dsh-smoke')
const hostRoot = join(testRoot, 'host')
const dshHome = join(testRoot, 'home')
const profile = 'tui-public-smoke'

const relativeTarget = relative(repoRoot, testRoot)
if (relativeTarget === '' || relativeTarget.startsWith('..') || isAbsolute(relativeTarget)) {
  throw new Error(`refusing to reset public-host smoke directory outside the repository: ${testRoot}`)
}

/** Run one child process and capture its combined output. */
function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const timeoutMs = options.timeoutMs ?? 180_000
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: options.env ?? process.env,
      shell: options.shell ?? false,
      windowsHide: true,
    })
    let output = ''
    const timeout = setTimeout(() => {
      const timeoutError = () => new Error(`${command} ${args.join(' ')} timed out after ${timeoutMs} ms:\n${output}`)
      if (process.platform === 'win32') {
        const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true })
        killer.on('error', reject)
        killer.on('close', () => reject(timeoutError()))
      } else {
        child.kill('SIGTERM')
        reject(timeoutError())
      }
    }, timeoutMs)
    child.stdout.on('data', chunk => { output += chunk })
    child.stderr.on('data', chunk => { output += chunk })
    child.on('error', error => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on('close', code => {
      clearTimeout(timeout)
      resolve({ code: code ?? 1, output })
    })
  })
}

/** Require a successful command and include its output in a failure. */
async function runChecked(command, args, options) {
  const result = await run(command, args, options)
  if (result.code !== 0) throw new Error(`${command} ${args.join(' ')} failed:\n${result.output}`)
  return result.output
}

await rm(testRoot, { recursive: true, force: true })
await mkdir(hostRoot, { recursive: true })
await writeFile(join(hostRoot, 'package.json'), JSON.stringify({ name: 'dsh-public-host-smoke', private: true }, null, 2) + '\n')

const installArgs = [
  'add',
  '--ignore-workspace',
  '--ignore-scripts',
  '--save-exact',
  '--config.auto-install-peers=true',
  '--config.strict-peer-dependencies=false',
  '--registry=https://registry.npmjs.org',
  '@deepseek-ai/dsh@0.1.0-rc.8',
]
const installCommand = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'pnpm'
const installCommandArgs = process.platform === 'win32' ? ['/d', '/s', '/c', 'pnpm', ...installArgs] : installArgs
console.log('Installing the public dsh host...')
await runChecked(installCommand, installCommandArgs, { cwd: hostRoot, timeoutMs: 300_000 })

const dshBin = join(hostRoot, 'node_modules/@deepseek-ai/dsh/lib/bin.js')
const dshEnv = { ...process.env, DSH_HOME: dshHome }
const dsh = (...args) => runChecked(process.execPath, [dshBin, ...args], { cwd: hostRoot, env: dshEnv })

console.log('Installing the packed TUI plugin...')
await dsh('plugin', '--profile', profile, 'add', archive)
console.log('Checking plugin resolution...')
const why = await dsh('plugin', '--profile', profile, 'why', '@lk251066/dsh-tui')
if (!why.includes(`@lk251066/dsh-tui@${packageManifest.version}`)) {
  throw new Error(`public-host why output did not identify the packed plugin:\n${why}`)
}

console.log('Checking the assembled profile...')
const dump = await dsh('--profile', profile, '--dump-config')
const bundledPlugins = [
  '@deepseek-ai/dsh-attachment-local',
  '@deepseek-ai/dsh-session-projection-cache',
  '@deepseek-ai/dsh-session-reference',
  '@deepseek-ai/dsh-session-stats',
  '@deepseek-ai/dsh-storage',
  '@deepseek-ai/dsh-storage-domain',
  '@deepseek-ai/dsh-storage-json',
  '@deepseek-ai/dsh-tool-ask-user',
  '@deepseek-ai/dsh-workspace',
  '@lk251066/dsh-tui/memory',
  '@lk251066/dsh-tui/workspace-agent-loop',
  '@lk251066/dsh-tui/prompt',
  '@lk251066/dsh-tui',
]
for (const plugin of bundledPlugins) {
  if (!dump.includes(`name: '${plugin}'`)) throw new Error(`public-host config omitted bundle plugin ${plugin}`)
}
if (dump.includes("name: '@deepseek-ai/dsh-memory'")) {
  throw new Error('public-host config still includes the unpublished memory plugin')
}

console.log('Checking non-interactive module loading...')
const launch = await run(process.execPath, [dshBin, '--profile', profile], { cwd: hostRoot, env: dshEnv })
if (launch.code === 0 || !launch.output.includes('both stdin and stdout must be TTYs')) {
  throw new Error(`non-interactive public-host launch did not reach the TUI requirement:\n${launch.output}`)
}
for (const moduleError of ['Cannot find package', 'ERR_MODULE_NOT_FOUND']) {
  if (launch.output.includes(moduleError)) throw new Error(`public-host launch failed module resolution:\n${launch.output}`)
}

console.log(`Verified @lk251066/dsh-tui@${packageManifest.version} with @deepseek-ai/dsh@0.1.0-rc.8.`)
