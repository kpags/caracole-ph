import { randomUUID } from 'node:crypto'
import { CopyObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'

const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/

function trimTrailingSlashes(value) {
  return value.replace(/\/+$/, '')
}

function validateObjectKey(value, label = 'Object key') {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${label} is required.`)
  }

  const key = value.trim()
  if (CONTROL_CHARACTERS.test(key) || key.includes('\\')) {
    throw new TypeError(`${label} contains invalid characters.`)
  }

  const segments = key.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new TypeError(`${label} must be a normalized path.`)
  }

  return key
}

function sanitizeFilename(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return 'file'
  }

  const filename = value.trim().replace(/\\/g, '/').split('/').pop()
  const sanitized = filename
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .replace(/-+\./g, '.')
    .slice(0, 120)

  return sanitized || 'file'
}

function normalizePrefix(prefix) {
  if (prefix === undefined || prefix === null || prefix === '') {
    return ''
  }

  return validateObjectKey(prefix, 'Prefix')
}

function encodeObjectKey(key) {
  return key.split('/').map(encodeURIComponent).join('/')
}

/**
 * Server-side Cloudflare R2 object storage utility.
 * R2 API credentials must never be exposed to browser code.
 */
export class CloudflareR2Storage {
  constructor({ accountId, bucketName, accessKeyId, secretAccessKey, publicBaseUrl, client, uploadFactory } = {}) {
    for (const [name, value] of Object.entries({ accountId, bucketName, accessKeyId, secretAccessKey, publicBaseUrl })) {
      if (typeof value !== 'string' || !value.trim()) {
        throw new TypeError(`Cloudflare R2 ${name} is required.`)
      }
    }

    const parsedPublicBaseUrl = new URL(publicBaseUrl)
    if (!['http:', 'https:'].includes(parsedPublicBaseUrl.protocol) || parsedPublicBaseUrl.search || parsedPublicBaseUrl.hash) {
      throw new TypeError('Cloudflare R2 publicBaseUrl must be an HTTP(S) URL without a query string or fragment.')
    }

    this.bucketName = bucketName.trim()
    this.publicBaseUrl = trimTrailingSlashes(parsedPublicBaseUrl.toString())
    this.client = client ?? new S3Client({
      region: 'auto',
      endpoint: `https://${accountId.trim()}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId.trim(),
        secretAccessKey: secretAccessKey.trim()
      }
    })
    this.uploadFactory = uploadFactory ?? ((options) => new Upload(options))
  }

  getPublicUrl(keyOrPublicUrl) {
    return `${this.publicBaseUrl}/${encodeObjectKey(this.resolveObjectKey(keyOrPublicUrl))}`
  }

  async upload({ body, fileName, contentType, prefix } = {}) {
    if (body === undefined || body === null) {
      throw new TypeError('Upload body is required.')
    }
    if (typeof contentType !== 'string' || !contentType.trim()) {
      throw new TypeError('Upload contentType is required.')
    }

    const normalizedPrefix = normalizePrefix(prefix)
    const key = `${normalizedPrefix ? `${normalizedPrefix}/` : ''}${randomUUID()}-${sanitizeFilename(fileName)}`
    const upload = this.uploadFactory({
      client: this.client,
      params: {
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType.trim()
      }
    })

    await upload.done()
    return this.getPublicUrl(key)
  }

  async delete(keyOrPublicUrl) {
    const key = this.resolveObjectKey(keyOrPublicUrl)
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }))
    return true
  }

  async rename(keyOrPublicUrl, newFileNameOrKey) {
    const sourceKey = this.resolveObjectKey(keyOrPublicUrl)
    const destinationKey = this.resolveDestinationKey(sourceKey, newFileNameOrKey)

    if (sourceKey === destinationKey) {
      throw new TypeError('Source and destination object keys must be different.')
    }

    await this.client.send(new CopyObjectCommand({
      Bucket: this.bucketName,
      Key: destinationKey,
      CopySource: `${encodeURIComponent(this.bucketName)}/${encodeObjectKey(sourceKey)}`,
      MetadataDirective: 'COPY'
    }))

    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: sourceKey }))
    } catch (error) {
      throw new Error('Object was copied but the source could not be deleted; both objects may exist.', { cause: error })
    }

    return this.getPublicUrl(destinationKey)
  }

  resolveObjectKey(keyOrPublicUrl) {
    if (typeof keyOrPublicUrl !== 'string' || !keyOrPublicUrl.trim()) {
      throw new TypeError('Object key or public URL is required.')
    }

    const value = keyOrPublicUrl.trim()
    if (!value.startsWith('http://') && !value.startsWith('https://')) {
      return validateObjectKey(value)
    }

    const url = new URL(value)
    if (url.search || url.hash) {
      throw new TypeError('Public URL does not belong to the configured Cloudflare R2 public base URL.')
    }

    const baseUrl = new URL(this.publicBaseUrl)
    if (url.origin !== baseUrl.origin || !url.pathname.startsWith(`${baseUrl.pathname.replace(/\/$/, '')}/`)) {
      throw new TypeError('Public URL does not belong to the configured Cloudflare R2 public base URL.')
    }

    const encodedKey = url.pathname.slice(baseUrl.pathname.replace(/\/$/, '').length).replace(/^\/+/, '')
    try {
      return validateObjectKey(decodeURIComponent(encodedKey))
    } catch (error) {
      throw new TypeError('Public URL does not contain a valid object key.', { cause: error })
    }
  }

  resolveDestinationKey(sourceKey, newFileNameOrKey) {
    if (typeof newFileNameOrKey !== 'string' || !newFileNameOrKey.trim()) {
      throw new TypeError('New file name or object key is required.')
    }

    const value = newFileNameOrKey.trim()
    if (value.includes('/')) {
      return validateObjectKey(value, 'Destination object key')
    }

    const sourceDirectory = sourceKey.includes('/') ? sourceKey.slice(0, sourceKey.lastIndexOf('/')) : ''
    return `${sourceDirectory ? `${sourceDirectory}/` : ''}${sanitizeFilename(value)}`
  }
}

export function createCloudflareR2StorageFromConfig(config) {
  return new CloudflareR2Storage({
    accountId: config.CLOUDFLARE_R2_ACCOUNT_ID,
    bucketName: config.CLOUDFLARE_R2_BUCKET_NAME,
    accessKeyId: config.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: config.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    publicBaseUrl: config.CLOUDFLARE_R2_PUBLIC_BASE_URL
  })
}
