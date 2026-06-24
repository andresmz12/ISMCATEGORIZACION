import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execPromise = promisify(exec)

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret')
  if (secret !== process.env.ADMIN_RESET_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { stdout, stderr } = await execPromise('npx prisma db push --accept-data-loss', {
      cwd: process.cwd(),
      timeout: 30000,
    })

    return NextResponse.json({
      success: true,
      stdout,
      stderr,
      message: 'Schema synchronized',
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stderr: error.stderr,
    })
  }
}
