import { copyFile } from 'node:fs/promises'

await copyFile('worker.mjs', 'dist/_worker.js')
