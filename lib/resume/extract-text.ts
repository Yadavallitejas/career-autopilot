export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  if (buffer.length > 30 * 1024 * 1024) {
    throw new Error('PDF too large (max 30MB)')
  }

  // STEP 1: Try text extraction first (works for text-based PDFs)
  let extractedText = ''
  try {
    // Use pdfjs-dist legacy build for serverless compatibility
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs' as string)
    pdfjsLib.GlobalWorkerOptions.workerSrc = ''

    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
    const pdfDoc = await loadingTask.promise
    const textPages: string[] = []

    for (let i = 1; i <= Math.min(pdfDoc.numPages, 3); i++) {
      const page = await pdfDoc.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items
        .map((item: { str?: string }) => item.str ?? '')
        .join(' ')
      textPages.push(pageText)
    }

    extractedText = textPages.join('\n\n').trim()
    console.log('[PDF] Text extraction got', extractedText.length, 'chars')
  } catch (textErr) {
    console.warn('[PDF] Text extraction error:', textErr)
  }

  // If we got enough text, use it
  if (extractedText.length >= 100) {
    return extractedText
  }

  // STEP 2: Text too short = image-based PDF. Fall back to vision model.
  // Render first page to PNG, pass to vision model as base64.
  console.log('[PDF] Text too short, falling back to vision model for image-based PDF')

  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs' as string)
    pdfjsLib.GlobalWorkerOptions.workerSrc = ''

    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
    const page = await pdfDoc.getPage(1)

    // Scale 2x for legibility
    const viewport = page.getViewport({ scale: 2.0 })

    // Use @napi-rs/canvas (already in serverExternalPackages)
    const { createCanvas } = await import('@napi-rs/canvas')
    const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height))
    const ctx = canvas.getContext('2d')

    await page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport
    }).promise

    const pngBuffer = canvas.toBuffer('image/png')
    const base64 = pngBuffer.toString('base64')

    console.log('[PDF] Rendered to PNG, size:', pngBuffer.length, 'bytes')

    // Pass to vision model
    const OpenAI = (await import('openai')).default
    const groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY ?? '',
      baseURL: 'https://api.groq.com/openai/v1'
    })

    const visionResponse = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${base64}`,
              detail: 'high'
            }
          },
          {
            type: 'text',
            text: `This is a certificate or professional document rendered from a PDF.
Extract all text content you can see:
- Recipient/person name
- Certificate or course name  
- Issuing organization
- Date completed
- Any grade, score, or distinction
- Course description or skills if visible
Be thorough and accurate. Extract exactly what you see.`
          }
        ]
      }]
    })

    const visionText = visionResponse.choices[0]?.message?.content ?? ''
    if (visionText.length > 50) {
      console.log('[PDF] Vision extracted:', visionText.slice(0, 200))
      return visionText
    }

    throw new Error('Vision model returned too little content')

  } catch (visionErr) {
    console.error('[PDF] Vision fallback also failed:', visionErr)
    throw new Error(
      'Could not read this PDF. It may be a complex image-based document. ' +
      'Try uploading the certificate as a JPG or PNG image instead — ' +
      'image uploads are processed more reliably.'
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
