export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  console.log('[PDF] Starting extraction, buffer size:', buffer.length)

  // Attempt 1: pdfjs-dist text extraction
  try {
    // The 'as string' cast is needed for Next.js module resolution
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    // @ts-ignore — GlobalWorkerOptions exists at runtime
    if (pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = ''
    }

    const data = new Uint8Array(buffer)
    // @ts-ignore — getDocument exists at runtime
    const loadingTask = pdfjsLib.getDocument({ data })
    const pdfDoc = await loadingTask.promise
    console.log('[PDF] Document loaded, pages:', pdfDoc.numPages)

    const textParts: string[] = []
    for (let i = 1; i <= Math.min(pdfDoc.numPages, 3); i++) {
      const page = await pdfDoc.getPage(i)
      const content = await page.getTextContent()
      const pageText = (content.items as Array<{ str?: string }>)
        .map((item) => item.str ?? '')
        .join(' ')
        .trim()
      textParts.push(pageText)
    }

    const fullText = textParts.join('\n\n').trim()
    console.log('[PDF] Text extraction result length:', fullText.length)
    console.log('[PDF] Text preview:', fullText.slice(0, 100))

    if (fullText.length >= 80) {
      return fullText
    }

    console.log('[PDF] Text too short — PDF is image-based, switching to vision')
  } catch (textErr) {
    console.warn('[PDF] Text extraction threw:', textErr instanceof Error ? textErr.message : textErr)
    console.log('[PDF] Falling back to vision model')
  }

  // Attempt 2: Vision model (for image-based PDFs like Coursera/IBM/Meta certs)
  try {
    console.log('[PDF] Rendering first page to PNG for vision model')

    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
    // @ts-ignore
    if (pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = ''
    }

    const data = new Uint8Array(buffer)
    // @ts-ignore
    const pdfDoc = await pdfjsLib.getDocument({ data }).promise
    const page = await pdfDoc.getPage(1)
    const viewport = page.getViewport({ scale: 2.0 })

    console.log('[PDF] Viewport:', Math.floor(viewport.width), 'x', Math.floor(viewport.height))

    // Try @napi-rs/canvas first, fall back to node-canvas
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let canvas: { getContext: (type: '2d') => unknown; toBuffer: (type: string) => Buffer }
    try {
      const { createCanvas } = await import('@napi-rs/canvas')
      canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height)) as unknown as typeof canvas
    } catch {
      // @napi-rs/canvas not available, try 'canvas' package
      const { createCanvas } = await import('canvas')
      canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height)) as unknown as typeof canvas
    }

    const ctx = canvas.getContext('2d')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.render({ canvasContext: ctx, viewport } as any).promise

    const pngBuffer = canvas.toBuffer('image/png')
    const base64 = pngBuffer.toString('base64')
    console.log('[PDF] PNG rendered, size:', pngBuffer.length, 'bytes')

    // Call vision model
    const { default: OpenAI } = await import('openai')
    const groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY ?? '',
      baseURL: 'https://api.groq.com/openai/v1'
    })

    const response = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${base64}`, detail: 'high' }
          },
          {
            type: 'text',
            text: 'This is a certificate. Extract all visible text: recipient name, course/certification name, issuing organization (company/university), date completed, any score or grade visible. Be thorough and accurate.'
          }
        ]
      }]
    })

    const visionText = response.choices[0]?.message?.content ?? ''
    console.log('[PDF] Vision model extracted:', visionText.slice(0, 200))

    if (visionText.length > 30) return visionText
    throw new Error('Vision model returned too little')

  } catch (visionErr) {
    console.error('[PDF] Vision also failed:', visionErr instanceof Error ? visionErr.message : visionErr)
    throw new Error(
      'Could not read this PDF. Try uploading the certificate as a JPG or PNG image instead.'
    )
  }
}

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    if (!result.value || result.value.trim().length < 50) {
      throw new Error('The document appears to be empty.')
    }
    return result.value
  } catch (error) {
    console.error('[DOCX Extraction] Failed:', error)
    throw new Error('Could not read the DOCX file. Please try a PDF, or paste your resume text directly.')
  }
}
