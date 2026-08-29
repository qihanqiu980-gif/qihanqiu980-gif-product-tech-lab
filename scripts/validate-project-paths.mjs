import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const ignoredDirectories = new Set(['.git', 'node_modules'])
const forbiddenPath = ['/Users', 'mac', 'Documents', 'ChatGPT', '编程学习'].join('/')
const forbiddenBytes = Buffer.from(forbiddenPath)
const matches = []
let filesScanned = 0

const scanDirectory = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  await Promise.all(entries.map(async (entry) => {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) return
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      await scanDirectory(absolutePath)
      return
    }
    if (!entry.isFile()) return
    filesScanned += 1
    const content = await readFile(absolutePath)
    if (content.includes(forbiddenBytes)) {
      matches.push(path.relative(projectRoot, absolutePath))
    }
  }))
}

await scanDirectory(projectRoot)

if (matches.length > 0) {
  console.error(JSON.stringify({
    valid: false,
    forbiddenPath,
    matches: matches.sort(),
  }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  valid: true,
  filesScanned,
  oldProjectPathReferences: 0,
}, null, 2))
