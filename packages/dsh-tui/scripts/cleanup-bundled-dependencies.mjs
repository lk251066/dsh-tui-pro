import { existsSync, lstatSync, rmSync, unlinkSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageModules = join(packageRoot, 'node_modules')
const dependencies = [
  '@earendil-works/pi-tui',
  'get-east-asian-width',
  'marked',
]

for (const dependency of dependencies) {
  const target = resolve(packageModules, ...dependency.split('/'))
  const relativeTarget = relative(packageModules, target)
  if (relativeTarget === '' || relativeTarget.startsWith(`..${sep}`) || relativeTarget === '..') {
    throw new Error(`refusing to clean bundled dependency outside package node_modules: ${target}`)
  }
  if (!existsSync(target)) continue
  if (lstatSync(target).isSymbolicLink()) unlinkSync(target)
  else rmSync(target, { recursive: true, force: true })
}
