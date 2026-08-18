import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { CopyObjectCommand, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { CloudflareR2Storage } from '../src/lib/cloudflare-r2-storage.js'

class FakeS3Client {
  constructor({ failDelete = false } = {}) {
    this.commands = []
    this.failDelete = failDelete
  }

  async send(command) {
    this.commands.push(command)
    if (this.failDelete && command instanceof DeleteObjectCommand) {
      throw new Error('delete failed')
    }
    return { ETag: 'etag' }
  }
}

function createStorage(client = new FakeS3Client()) {
  return new CloudflareR2Storage({
    accountId: 'account-id',
    bucketName: 'website-media',
    accessKeyId: 'access-key',
    secretAccessKey: 'secret-key',
    publicBaseUrl: 'https://media.caracole.ph',
    client,
    uploadFactory: ({ client: uploadClient, params }) => ({
      done: () => uploadClient.send(new PutObjectCommand(params))
    })
  })
}

const serverDirectory = fileURLToPath(new URL('..', import.meta.url))
const validEnvironment = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/caracole?schema=public',
  CORS_ORIGIN: 'http://localhost:5173',
  APP_NAME: 'Caracole PH',
  JWT_ACCESS_SECRET: 'a-very-long-access-secret-for-tests-only',
  JWT_REFRESH_SECRET: 'a-very-long-refresh-secret-for-tests-only',
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_SECURE: 'false',
  SMTP_USER: 'smtp-user',
  SMTP_PASSWORD: 'smtp-password',
  EMAIL_FROM: 'Caracole PH <no-reply@example.com>',
  CLOUDFLARE_R2_ACCOUNT_ID: 'account-id',
  CLOUDFLARE_R2_BUCKET_NAME: 'website-media',
  CLOUDFLARE_R2_ACCESS_KEY_ID: 'access-key',
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'secret-key',
  SHOPIFY_STORE_DOMAIN: 'dexterton-2.myshopify.com',
  SHOPIFY_PRIVATE_ACCESS_TOKEN: 'shopify-token',
  SHOPIFY_CLIENT_ID: 'shopify-client-id',
  SHOPIFY_CLIENT_SECRET: 'shopify-client-secret',
  CLOUDFLARE_R2_PUBLIC_BASE_URL: 'https://media.caracole.ph'
}

function validateRuntimeConfig(environment = {}) {
  return spawnSync(process.execPath, ['--input-type=module', '--eval', "import './src/config.js'"], {
    cwd: serverDirectory,
    env: {
      ...process.env,
      ...validEnvironment,
      ...environment,
      DOTENV_CONFIG_PATH: '__no_local_environment_file__'
    },
    encoding: 'utf8'
  })
}

test('uploads content under a sanitized prefix and returns its public URL', async () => {
  const client = new FakeS3Client()
  const storage = createStorage(client)
  const url = await storage.upload({
    body: Buffer.from('image data'),
    fileName: 'Hero image!.jpg',
    contentType: 'image/jpeg',
    prefix: 'hero-banners'
  })

  assert.match(url, /^https:\/\/media\.caracole\.ph\/hero-banners\/[0-9a-f-]{36}-Hero-image\.jpg$/)
  assert.equal(client.commands.length, 1)
  assert.ok(client.commands[0] instanceof PutObjectCommand)
  assert.equal(client.commands[0].input.Bucket, 'website-media')
  assert.equal(client.commands[0].input.ContentType, 'image/jpeg')
})

test('deletes using a stored object key or the returned public URL', async () => {
  const client = new FakeS3Client()
  const storage = createStorage(client)

  await storage.delete('products/chair.jpg')
  await storage.delete('https://media.caracole.ph/products/chair.jpg')

  assert.deepEqual(client.commands.map((command) => command.input.Key), ['products/chair.jpg', 'products/chair.jpg'])
  assert.ok(client.commands.every((command) => command instanceof DeleteObjectCommand))
})

test('renames by copying first, then deleting the source, and returns the new public URL', async () => {
  const client = new FakeS3Client()
  const storage = createStorage(client)
  const url = await storage.rename('https://media.caracole.ph/products/old-chair.jpg', 'new-chair.jpg')

  assert.equal(url, 'https://media.caracole.ph/products/new-chair.jpg')
  assert.ok(client.commands[0] instanceof CopyObjectCommand)
  assert.equal(client.commands[0].input.CopySource, 'website-media/products/old-chair.jpg')
  assert.equal(client.commands[0].input.MetadataDirective, 'COPY')
  assert.ok(client.commands[1] instanceof DeleteObjectCommand)
  assert.equal(client.commands[1].input.Key, 'products/old-chair.jpg')
})

test('does not report a rename as successful when source deletion fails', async () => {
  const client = new FakeS3Client({ failDelete: true })
  const storage = createStorage(client)

  await assert.rejects(() => storage.rename('products/old-chair.jpg', 'new-chair.jpg'), /both objects may exist/)
  assert.ok(client.commands[0] instanceof CopyObjectCommand)
  assert.ok(client.commands[1] instanceof DeleteObjectCommand)
})

test('rejects URLs outside of the configured public media domain', async () => {
  const storage = createStorage()
  await assert.rejects(() => storage.delete('https://example.com/products/chair.jpg'), /does not belong/)
})

test('requires complete Cloudflare R2 configuration at runtime', () => {
  assert.equal(validateRuntimeConfig().status, 0)

  const result = validateRuntimeConfig({ CLOUDFLARE_R2_PUBLIC_BASE_URL: '' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /CLOUDFLARE_R2_PUBLIC_BASE_URL/)
})
