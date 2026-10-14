import { access, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { dirname, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { deflateRawSync } from "node:zlib"

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const buildDirectory = resolve(projectRoot, "dist")
const unpackedDirectory = resolve(projectRoot, "ViewportStudio")
const downloadsDirectory = resolve(projectRoot, "downloads")
const zipPath = resolve(downloadsDirectory, "ViewportStudio-Chrome.zip")

try {
  await access(resolve(buildDirectory, "manifest.json"))
} catch {
  throw new Error("The extension build is missing. Run `pnpm package:chrome` to build and package it.")
}

await rm(unpackedDirectory, { recursive: true, force: true })
await cp(buildDirectory, unpackedDirectory, { recursive: true })

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  return crc >>> 0
})

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await listFiles(path)))
    else if (entry.isFile()) files.push(path)
  }
  return files
}

const now = new Date()
const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)
const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()
const localParts = []
const centralParts = []
let offset = 0
const files = await listFiles(unpackedDirectory)

for (const path of files) {
  const relativePath = relative(unpackedDirectory, path).split(sep).join("/")
  const name = Buffer.from(`ViewportStudio/${relativePath}`)
  const data = await readFile(path)
  const compressed = deflateRawSync(data)
  const checksum = crc32(data)

  const localHeader = Buffer.alloc(30)
  localHeader.writeUInt32LE(0x04034b50, 0)
  localHeader.writeUInt16LE(20, 4)
  localHeader.writeUInt16LE(0, 6)
  localHeader.writeUInt16LE(8, 8)
  localHeader.writeUInt16LE(dosTime, 10)
  localHeader.writeUInt16LE(dosDate, 12)
  localHeader.writeUInt32LE(checksum, 14)
  localHeader.writeUInt32LE(compressed.length, 18)
  localHeader.writeUInt32LE(data.length, 22)
  localHeader.writeUInt16LE(name.length, 26)
  localHeader.writeUInt16LE(0, 28)
  localParts.push(localHeader, name, compressed)

  const centralHeader = Buffer.alloc(46)
  centralHeader.writeUInt32LE(0x02014b50, 0)
  centralHeader.writeUInt16LE(20, 4)
  centralHeader.writeUInt16LE(20, 6)
  centralHeader.writeUInt16LE(0, 8)
  centralHeader.writeUInt16LE(8, 10)
  centralHeader.writeUInt16LE(dosTime, 12)
  centralHeader.writeUInt16LE(dosDate, 14)
  centralHeader.writeUInt32LE(checksum, 16)
  centralHeader.writeUInt32LE(compressed.length, 20)
  centralHeader.writeUInt32LE(data.length, 24)
  centralHeader.writeUInt16LE(name.length, 28)
  centralHeader.writeUInt16LE(0, 30)
  centralHeader.writeUInt16LE(0, 32)
  centralHeader.writeUInt16LE(0, 34)
  centralHeader.writeUInt16LE(0, 36)
  centralHeader.writeUInt32LE(0, 38)
  centralHeader.writeUInt32LE(offset, 42)
  centralParts.push(centralHeader, name)
  offset += localHeader.length + name.length + compressed.length
}

const centralDirectory = Buffer.concat(centralParts)
const endRecord = Buffer.alloc(22)
endRecord.writeUInt32LE(0x06054b50, 0)
endRecord.writeUInt16LE(0, 4)
endRecord.writeUInt16LE(0, 6)
endRecord.writeUInt16LE(files.length, 8)
endRecord.writeUInt16LE(files.length, 10)
endRecord.writeUInt32LE(centralDirectory.length, 12)
endRecord.writeUInt32LE(offset, 16)
endRecord.writeUInt16LE(0, 20)

await mkdir(downloadsDirectory, { recursive: true })
await writeFile(zipPath, Buffer.concat([...localParts, centralDirectory, endRecord]))

console.log("Chrome-ready extension created in ViewportStudio/ and downloads/ViewportStudio-Chrome.zip.")
