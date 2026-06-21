const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        const page = await browser.newPage();
        
        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
        page.on('pageerror', error => console.error('BROWSER ERROR:', error.message));
        
        await page.goto('http://localhost:3005');
        
        await new Promise(r => setTimeout(r, 2000));
        await browser.close();
    } catch (e) {
        console.error('Puppeteer failed:', e.message);
    }
})();
