const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const defaultOutputDir = path.join(__dirname, '..', 'public', 'category')
const defaultInputDir = process.env.CATEGORY_IMAGE_INPUT_DIR || process.cwd()

const files = {
  'media__1771686165125.png': 'healsio.webp',
  'media__1771686178284.png': 'hotcook.webp',
  'media__1771686188656.png': 'quick.webp',
  'media__1771686496638.png': 'main.webp',
  'media__1771686508941.png': 'side.webp',
  'media__1771686514137.png': 'soup.webp',
  'media__1771686520007.png': 'one-dish.webp',
  'media__1771686529989.png': 'sweets.webp',
}

function parseArgs() {
  const args = process.argv.slice(2)
  let inputDir = defaultInputDir
  let outputDir = defaultOutputDir

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--input' && args[i + 1]) {
      inputDir = path.resolve(args[i + 1])
      i += 1
      continue
    }
    if (arg === '--output' && args[i + 1]) {
      outputDir = path.resolve(args[i + 1])
      i += 1
    }
  }

  return { inputDir, outputDir }
}

async function processImages() {
  const { inputDir, outputDir } = parseArgs()
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  for (const [inFile, outFile] of Object.entries(files)) {
    const inputPath = path.join(inputDir, inFile)
    const outputPath = path.join(outputDir, outFile)

    if (!fs.existsSync(inputPath)) {
      console.warn(`Input file not found: ${inputPath}`)
      continue
    }

    try {
      await sharp(inputPath)
        .resize(400, 400, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 80 })
        .toFile(outputPath)
      console.log(`Successfully processed ${outFile}`)
    } catch (err) {
      console.error(`Error processing ${inFile}:`, err)
    }
  }
}

processImages()
