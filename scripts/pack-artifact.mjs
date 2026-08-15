import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const packageRoot = join(repositoryRoot, 'packages', 'dsh-tui')
const npmArgs = ['pack', '--pack-destination', '..']
const packCommand = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'npm'
const packArgs = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm', ...npmArgs] : npmArgs

function run(command, args, cwd = repositoryRoot) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      windowsHide: true,
    })
    child.on('error', reject)
    child.on('close', code => code === 0
      ? resolve()
      : reject(new Error(`${command} ${args.join(' ')} exited with ${String(code)}`)))
  })
}

try {
  await run(packCommand, packArgs, packageRoot)
} finally {
  await run(process.execPath, [join('packages', 'dsh-tui', 'scripts', 'cleanup-bundled-dependencies.mjs')])
}
