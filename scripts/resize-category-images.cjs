const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\jrmag\\.gemini\\antigravity\\brain\\98c242f0-17d4-4a73-8ab4-a86556ab0c0c';
const outputDir = path.join(__dirname, '..', 'public', 'category');

const files = {
    'media__1771686165125.png': 'healsio.webp',
    'media__1771686178284.png': 'hotcook.webp',
    'media__1771686188656.png': 'quick.webp',
    'media__1771686496638.png': 'main.webp',
    'media__1771686508941.png': 'side.webp',
    'media__1771686514137.png': 'soup.webp',
    'media__1771686520007.png': 'one-dish.webp',
    'media__1771686529989.png': 'sweets.webp',
};

async function processImages() {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const [inFile, outFile] of Object.entries(files)) {
        const inputPath = path.join(brainDir, inFile);
        const outputPath = path.join(outputDir, outFile);

        if (fs.existsSync(inputPath)) {
            try {
                await sharp(inputPath)
                    .resize(400, 400, {
                        fit: 'cover',
                        position: 'center'
                    })
                    .webp({ quality: 80 })
                    .toFile(outputPath);
                console.log(`Successfully processed ${outFile}`);
            } catch (err) {
                console.error(`Error processing ${inFile}:`, err);
            }
        } else {
            console.warn(`Input file not found: ${inputPath}`);
        }
    }
}

processImages();
