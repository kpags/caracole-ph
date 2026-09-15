import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { HttpError } from './http.js'

const execFileAsync = promisify(execFile)
const JPEG_SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

function invalidImage() {
  throw new HttpError(400, 'Testimonial image could not be read')
}

function inspectJpeg(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) invalidImage()
  let offset = 2
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue }
    let markerOffset = offset + 1
    while (buffer[markerOffset] === 0xff) markerOffset += 1
    const marker = buffer[markerOffset]
    if (marker === 0xd9 || marker === 0xda) break
    const length = buffer.readUInt16BE(markerOffset + 1)
    if (length < 2 || markerOffset + 1 + length > buffer.length) invalidImage()
    if (JPEG_SOF_MARKERS.has(marker)) {
      return { width: buffer.readUInt16BE(markerOffset + 6), height: buffer.readUInt16BE(markerOffset + 4) }
    }
    offset = markerOffset + 1 + length
  }
  invalidImage()
}

function inspectWebp(buffer) {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') invalidImage()
  const codec = buffer.toString('ascii', 12, 16)
  if (codec === 'VP8X') return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) }
  if (codec === 'VP8 ') return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff }
  if (codec === 'VP8L') {
    const value = buffer.readUInt32LE(21)
    return { width: (value & 0x3fff) + 1, height: ((value >> 14) & 0x3fff) + 1 }
  }
  invalidImage()
}

export function inspectTestimonialImage(buffer, mimeType) {
  if (mimeType === 'image/png') {
    if (buffer.length < 24 || buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') invalidImage()
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
  }
  if (mimeType === 'image/jpeg') return inspectJpeg(buffer)
  if (mimeType === 'image/webp') return inspectWebp(buffer)
  invalidImage()
}

async function inspectVideo(buffer, originalName) {
  const folder = await mkdtemp(path.join(tmpdir(), 'caracole-testimonial-'))
  const extension = path.extname(originalName || '').replace(/[^.a-z0-9]/gi, '') || '.media'
  const mediaPath = path.join(folder, `media${extension}`)
  try {
    await writeFile(mediaPath, buffer)
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,duration',
      '-show_entries', 'format=duration', '-of', 'json', mediaPath
    ])
    const details = JSON.parse(stdout)
    const stream = details.streams?.[0]
    const duration = Number(stream?.duration || details.format?.duration)
    if (!stream?.width || !stream?.height || !Number.isFinite(duration)) {
      throw new HttpError(400, 'Testimonial video could not be read')
    }
    return { width: stream.width, height: stream.height, duration }
  } catch (error) {
    if (error instanceof HttpError) throw error
    if (error?.code === 'ENOENT') throw new HttpError(500, 'Testimonial video inspection requires ffprobe. Rebuild the API container or install FFmpeg.')
    throw new HttpError(400, 'Testimonial video could not be read')
  } finally {
    await rm(folder, { recursive: true, force: true }).catch(() => {})
  }
}

export async function inspectTestimonialMedia(file) {
  if (file.mimetype.startsWith('image/')) return { type: 'image', ...inspectTestimonialImage(file.buffer, file.mimetype) }
  return { type: 'video', ...await inspectVideo(file.buffer, file.originalname) }
}

export function validateTestimonialMediaDetails(details) {
  const { type, duration } = details || {}
  if (type === 'video' && (!Number.isFinite(duration) || duration > 10)) {
    throw new HttpError(400, 'Testimonial videos must be 10 seconds or shorter')
  }
}
