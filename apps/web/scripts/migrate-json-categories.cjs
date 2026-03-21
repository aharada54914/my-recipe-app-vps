const fs = require('fs');
const path = require('path');

const hotcookPath = path.join(__dirname, '..', 'src', 'data', 'recipes-hotcook.json');
const healsioPath = path.join(__dirname, '..', 'src', 'data', 'recipes-healsio.json');

function migrateFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        return;
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    let modified = false;
    data.forEach(recipe => {
        if (recipe.category === 'ご飯もの') {
            recipe.category = '一品料理';
            modified = true;
        } else if (recipe.category === 'デザート') {
            recipe.category = 'スイーツ';
            modified = true;
        }
    });

    if (modified) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`Successfully migrated categories in ${path.basename(filePath)}`);
    } else {
        console.log(`No changes needed in ${path.basename(filePath)}`);
    }
}

migrateFile(hotcookPath);
migrateFile(healsioPath);
