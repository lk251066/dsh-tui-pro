import { cpSync, existsSync, lstatSync, mkdirSync, realpathSync, rmSync, unlinkSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = resolve(packageRoot, '..', '..')
const packageModules = join(packageRoot, 'node_modules')
const dependencies = [
  '@earendil-works/pi-tui',
  'get-east-asian-width',
  'marked',
]

function targetPath(name) {
  const target = resolve(packageModules, ...name.split('/'))
  const relativeTarget = relative(packageModules, target)
  if (relativeTarget === '' || relativeTarget.startsWith(`..${sep}`) || relativeTarget === '..') {
    throw new Error(`refusing to stage bundled dependency outside package node_modules: ${target}`)
  }
  return target
}

function removeTarget(target) {
  if (!existsSync(target)) return
  if (lstatSync(target).isSymbolicLink()) unlinkSync(target)
  else rmSync(target, { recursive: true, force: true })
}

for (const dependency of dependencies) {
  const source = realpathSync(join(repositoryRoot, 'node_modules', ...dependency.split('/')))
  const target = targetPath(dependency)
  removeTarget(target)
  mkdirSync(dirname(target), { recursive: true })
  cpSync(source, target, { recursive: true, dereference: true })
}
