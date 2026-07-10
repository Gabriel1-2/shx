const puppeteer = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const { createCursor } = require('ghost-cursor');
const fs = require('fs');

const Config = {
    recordOptions: {
        followNewTab: false,
        fps: 120, // Upgrade to 120 FPS
        videoFrame: {
            width: 1920,
            height: 1080,
        },
        videoCrf: 18,
        videoCodec: 'libx264',
        videoPreset: 'ultrafast',
        videoBitrate: 8000, // Higher bitrate for 120 FPS
        autopad: {
            color: 'black',
        },
        aspectRatio: '16:9',
    }
};

(async () => {
    console.log("🚀 Launching browser...");
    const browser = await puppeteer.launch({
        headless: 'new',
        defaultViewport: {
            width: 1920,
            height: 1080,
        },
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1920,1080',
            '--disable-dev-shm-usage',
            '--disable-web-security',
        ]
    });

    const page = await browser.newPage();

    // Inject visual cursor
    await page.evaluateOnNewDocument(() => {
        document.addEventListener('DOMContentLoaded', () => {
            const cursor = document.createElement('div');
            cursor.id = 'puppeteer-cursor';
            cursor.style.width = '24px';
            cursor.style.height = '24px';
            cursor.style.background = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='white' stroke='black' stroke-width='1.5'><path d='M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.45 0 .67-.54.35-.85L6.35 2.85a.5.5 0 0 0-.85.36Z'/></svg>") no-repeat`;
            cursor.style.position = 'fixed';
            cursor.style.pointerEvents = 'none';
            cursor.style.zIndex = '99999999';
            cursor.style.top = '0px';
            cursor.style.left = '0px';
            cursor.style.filter = 'drop-shadow(2px 2px 3px rgba(0,0,0,0.5))';
            document.body.appendChild(cursor);

            document.addEventListener('mousemove', (e) => {
                cursor.style.left = e.clientX + 'px';
                cursor.style.top = e.clientY + 'px';
            });
            document.addEventListener('mousedown', () => {
                cursor.style.transform = 'scale(0.8)';
            });
            document.addEventListener('mouseup', () => {
                cursor.style.transform = 'scale(1)';
            });
        });
    });

    const cursor = createCursor(page);
    const recorder = new PuppeteerScreenRecorder(page, Config.recordOptions);

    console.log("🌐 Navigating to local exchange...");
    try {
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });
    } catch (e) {
        console.error("❌ Failed to load http://localhost:3000. Is the Next.js server running?");
        await browser.close();
        process.exit(1);
    }

    await new Promise(r => setTimeout(r, 2000));

    const timeline = [];
    let startTime = 0;

    const logEvent = (type) => {
        if (startTime === 0) return;
        const timeOffset = Date.now() - startTime;
        timeline.push({ type, timeMs: timeOffset });
        console.log(`[Timeline] Logged '${type}' at ${timeOffset}ms`);
    };

    console.log("🎥 Starting 120 FPS recording...");
    await recorder.start('./shx-ad-raw.mp4');
    startTime = Date.now(); // Mark start time immediately after recording begins

    await new Promise(r => setTimeout(r, 1000));

    // --- STORYBOARD ---
    try {
        console.log("🎬 Action: Moving around home page...");
        await cursor.moveTo({ x: 500, y: 300 });
        await new Promise(r => setTimeout(r, 1000));
        await cursor.moveTo({ x: 800, y: 500 });
        logEvent('swoosh');
        await new Promise(r => setTimeout(r, 1000));
        
        await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
        await new Promise(r => setTimeout(r, 2000));
        logEvent('swoosh');
        await page.evaluate(() => window.scrollBy({ top: -400, behavior: 'smooth' }));
        await new Promise(r => setTimeout(r, 1500));

        console.log("🎬 Action: Clicking 'Pro Trade'...");
        const proLink = await page.$('a[href="/pro"]');
        if (proLink) {
            logEvent('click');
            await cursor.click(proLink);
        } else {
            await page.goto('http://localhost:3000/pro', { waitUntil: 'networkidle2' });
        }

        console.log("🎬 Action: Wait for Pro page to load...");
        logEvent('transition');
        await new Promise(r => setTimeout(r, 3000));

        console.log("🎬 Action: Move to token selector...");
        const tokenSelector = await page.$('button.flex.items-center.gap-2.px-3');
        if (tokenSelector) {
            logEvent('click');
            await cursor.click(tokenSelector);
            await new Promise(r => setTimeout(r, 1000));
            
            const shxOption = await page.evaluateHandle(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                return buttons.find(b => b.textContent && b.textContent.includes('SHX'));
            });
            if (shxOption) {
                logEvent('click');
                await cursor.click(shxOption);
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        console.log("🎬 Action: Simulating input in Jupiter...");
        await cursor.moveTo({ x: 1000, y: 600 });
        logEvent('click');
        await new Promise(r => setTimeout(r, 2000));
        
    } catch (e) {
        console.error("⚠️ Storyboard encountered an error, stopping early:", e);
    }

    await new Promise(r => setTimeout(r, 2000));

    console.log("⏹️ Stopping recording...");
    await recorder.stop();
    await browser.close();

    // Save timeline
    fs.writeFileSync('./timeline.json', JSON.stringify(timeline, null, 2));
    console.log("✅ Ad recording saved as 'shx-ad-raw.mp4'");
    console.log("✅ Timeline events saved to 'timeline.json'");
})();
