import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { fileUrl } = await req.json()
  try {
    const response = await fetch(fileUrl)
    const buffer = Buffer.from(await response.arrayBuffer())
    const pdfMod = await import('pdf-parse')
    const pdfParse: (buf: Buffer) => Promise<{ text: string; numpages: number; info: unknown }> =
      (pdfMod as any).default ?? (pdfMod as any)
    const data = await pdfParse(buffer)
    return NextResponse.json({
      success: true,
      textLength: data.text.length,
      preview: data.text.substring(0, 500),
      pages: data.numpages,
    })
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
    })
  }
}
