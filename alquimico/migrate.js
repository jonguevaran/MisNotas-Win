const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'aqs_1781509983078');
const destNbDir = path.join(__dirname, 'data', 'Migradas', 'Antiguas');

// Create destination directories
if (!fs.existsSync(destNbDir)) {
    fs.mkdirSync(destNbDir, { recursive: true });
}

// Helper to find image locally
function findLocalImage(basename) {
    const searchDirs = ['ININ-img', 'SERVIDORES-img', 'img'];
    for (const dir of searchDirs) {
        const fullPath = path.join(srcDir, dir, basename);
        if (fs.existsSync(fullPath)) {
            return fullPath;
        }
    }
    return null;
}

// Sanitize filename
function sanitizeName(name) {
    return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
}

const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.json') && !f.startsWith('CACHE'));

for (const file of files) {
    const jsonPath = path.join(srcDir, file);
    let data;
    try {
        data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch (e) {
        console.error(`Error parsing ${file}`);
        continue;
    }

    if (!data.blocks || data.blocks.length === 0) continue;

    // Find the first title for the note name
    let noteName = file.replace('.json', '');
    const firstTitle = data.blocks.find(b => b.type === 'title');
    if (firstTitle && firstTitle.content) {
        noteName = sanitizeName(firstTitle.content);
    }
    
    // Avoid duplicates
    let finalNoteName = noteName;
    let counter = 1;
    while (fs.existsSync(path.join(destNbDir, finalNoteName))) {
        finalNoteName = `${noteName} (${counter})`;
        counter++;
    }

    const noteDir = path.join(destNbDir, finalNoteName);
    const imgDir = path.join(noteDir, 'img');
    fs.mkdirSync(noteDir, { recursive: true });
    fs.mkdirSync(imgDir, { recursive: true });

    let zcodexContent = '';
    let isFirstTitle = true;

    for (const block of data.blocks) {
        const type = block.type;
        const content = block.content;

        if (type === 'title') {
            if (isFirstTitle) {
                zcodexContent += `--h1 ${content}\n\n`;
                isFirstTitle = false;
            } else {
                zcodexContent += `--h2 ${content}\n\n`;
            }
        } else if (type === 'paragraph' || type === 'text') {
            zcodexContent += `--p ${content} p--\n\n`;
        } else if (type === 'code') {
            zcodexContent += `--precode\n${content}\nprecode--\n\n`;
        } else if (type === 'image') {
            let imgUrl = content;
            if (content.startsWith('file:///')) {
                const basename = path.basename(decodeURIComponent(content));
                const localImgPath = findLocalImage(basename);
                if (localImgPath) {
                    const newImgPath = path.join(imgDir, basename);
                    fs.copyFileSync(localImgPath, newImgPath);
                    imgUrl = `img/${basename}`;
                }
            }
            zcodexContent += `--img -${imgUrl}--Imagen- img--\n\n`;
        } else {
            // fallback
            zcodexContent += `--p ${content} p--\n\n`;
        }
    }

    const destFile = path.join(noteDir, `${finalNoteName}.txt`);
    fs.writeFileSync(destFile, zcodexContent, 'utf8');
    console.log(`Migrated ${file} to ${finalNoteName}`);
}

console.log('Migration completed!');
