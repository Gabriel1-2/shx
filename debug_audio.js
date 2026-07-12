const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));
    
    await page.goto('http://localhost:3005');
    
    // Click the start button to initialize audio and commercial
    await page.waitForSelector('#start-btn', { timeout: 5000 });
    await page.click('#start-btn');
    console.log('Clicked start');
    
    // Wait a few seconds to see if audio cuts out or errors happen
    await new Promise(r => setTimeout(r, 10000));
    
    // Simulate recording start just in case it breaks there
    // We can't actually press 'R' easily unless we send a key event
    await page.keyboard.press('r');
    console.log('Pressed R');
    
    await new Promise(r => setTimeout(r, 10000));
    
    await browser.close();
})();
