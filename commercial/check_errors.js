const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

    console.log('Navigating to http://localhost:3005...');
    await page.goto('http://localhost:3005');
    
    // Trigger the button click
    console.log('Clicking button...');
    await page.click('#start-btn').catch(e => console.log("Failed to click button", e));
    
    // wait a moment for errors
    await new Promise(r => setTimeout(r, 4000));
    
    await browser.close();
})();
