const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
    
    await page.goto('http://localhost:3005');
    console.log("Page loaded. Clicking start...");
    await page.waitForSelector('#start-btn', {timeout: 2000}).catch(()=>console.log("No start button"));
    await page.click('#start-btn').catch(()=>console.log("Click failed"));
    
    console.log("Waiting 4 seconds...");
    await new Promise(r => setTimeout(r, 4000));
    
    await browser.close();
    console.log("Done");
})();
