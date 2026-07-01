import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

const s3 = new S3Client({
  region: process.env.STORAGE_REGION || 'auto',
  endpoint: process.env.STORAGE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: !!process.env.STORAGE_ENDPOINT,
})

export async function uploadFile(key: string, buffer: Buffer, mimeType: string): Promise<string> {
  await s3.send(new PutObjectCommand({
    Bucket: process.env.STORAGE_BUCKET!,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  }))
  return `${process.env.STORAGE_PUBLIC_URL}/${key}`
}

export async function deleteFile(url: string): Promise<void> {
  const base = process.env.STORAGE_PUBLIC_URL!
  const key = url.replace(`${base}/`, '')
  await s3.send(new DeleteObjectCommand({
    Bucket: process.env.STORAGE_BUCKET!,
    Key: key,
  }))
}
