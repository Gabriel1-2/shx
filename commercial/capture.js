const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });
        
        // Go to ad
        await page.goto('http://localhost:3005');
        
        // Emulate a click to start audio context and rendering
        await page.click('body');
        

        await page.goto('http://localhost:3005');
        await page.click('body'); // start audio
        
        const path = require('path');
        const fs = require('fs');
        const outDir = 'C:\\Users\\rimma\\.gemini\\antigravity\\brain\\df47e497-b17b-466e-992d-154f1142bb7d\\scratch';
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, {recursive: true});

        console.log("Capturing frames...");
        for (let i = 0; i < 12; i++) {
            await new Promise(r => setTimeout(r, 1000)); // 1s real = 10s sim
            await page.screenshot({ path: path.join(outDir, `frame_${i*10}s.png`) });
            console.log(`Captured frame ${i*10}s`);
        }
        
        await browser.close();
    } catch(e) {
        console.error(e);
    }
})();
