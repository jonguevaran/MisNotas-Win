const fs = require('fs');

function extractLargestPngFromIco(icoPath, outPath) {
    const buffer = fs.readFileSync(icoPath);
    const numImages = buffer.readUInt16LE(4);
    
    let maxBytes = 0;
    let maxOffset = 0;
    
    for (let i = 0; i < numImages; i++) {
        const offset = 6 + (i * 16);
        const width = buffer.readUInt8(offset);
        const height = buffer.readUInt8(offset + 1);
        const bytesInRes = buffer.readUInt32LE(offset + 8);
        const imageOffset = buffer.readUInt32LE(offset + 12);
        
        // A PNG inside ICO starts with PNG signature: 89 50 4E 47 0D 0A 1A 0A
        const isPng = buffer.readUInt32BE(imageOffset) === 0x89504E47;
        
        if (isPng && bytesInRes > maxBytes) {
            maxBytes = bytesInRes;
            maxOffset = imageOffset;
        }
    }
    
    if (maxOffset > 0) {
        const pngData = buffer.slice(maxOffset, maxOffset + maxBytes);
        fs.writeFileSync(outPath, pngData);
        console.log("Successfully extracted PNG of size: " + maxBytes);
    } else {
        console.log("No PNG found in ICO.");
    }
}

extractLargestPngFromIco('icoEitrion.ico', 'MisNotas-E/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png');
extractLargestPngFromIco('icoEitrion.ico', 'MisNotas-E/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png');
