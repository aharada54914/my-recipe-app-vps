const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\jrmag\\.gemini\\antigravity\\brain\\98c242f0-17d4-4a73-8ab4-a86556ab0c0c';
const outputDir = path.join(__dirname, '..', 'public', 'category');

const files = {
    'media__1771686165125.png': 'healsio.png',
    'media__1771686178284.png': 'hotcook.png',
    'media__1771686188656.png': 'quick.png',
    'media__1771686496638.png': 'main.png',
    'media__1771686508941.png': 'side.png',
    'media__1771686514137.png': 'soup.png',
    'media__1771686520007.png': 'one-dish.png',
    'media__1771686529989.png': 'sweets.png',
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
                const image = await Jimp.read(inputPath);
                // Crop to square if not square, then resize
                const { width, height } = image.bitmap;
                const size = Math.min(width, height);
                const x = (width - size) / 2;
                const y = (height - size) / 2;

                await image
                    .crop(x, y, size, size)
                    .resize(400, 400)
                    .quality(80)
                    .writeAsync(outputPath);

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
