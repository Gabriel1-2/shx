export class TextSampler {
    constructor() {
        this.canvas = document.getElementById('sampler-canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.canvas.width = 1200;
        this.canvas.height = 400;
        this.points = [];
        this.trumpPoints = [];
        this.solanaPoints = [];
        this.shxPoints = [];
    }

    async preloadImages() {
        try {
            this.trumpPoints = await this.sampleImageAsPoints('./images/trump_coin.png', 0.8);
        } catch(e) {
            console.log("Failed to load Trump coin image, using text fallback");
            this.trumpPoints = this.sampleToken('TRUMP', 1.5);
        }
        this.solanaPoints = this.sampleToken('SOL', 1.2);
        this.shxPoints = this.sampleLogo(12.0);
    }

    sampleText(text, fontSize = 80, scale = 3.0) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = `bold ${fontSize}px 'Courier New', Courier, monospace`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        
        // Multi-line support if needed, but mostly single lines
        ctx.fillText(text, this.canvas.width/2, this.canvas.height/2);
        
        return this.extractPoints(scale);
    }

    sampleToken(text, scale = 3.0) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw coin circle
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 15;
        ctx.beginPath();
        ctx.arc(this.canvas.width/2, this.canvas.height/2, 120, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'white';
        ctx.font = `bold 60px 'Courier New', Courier, monospace`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(text, this.canvas.width/2, this.canvas.height/2);
        
        return this.extractPoints(scale);
    }

    async sampleImageAsPoints(imageUrl, scale = 1.0) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                const ctx = this.ctx;
                ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                
                // Draw image centered and scaled down to fit 200x200 max roughly
                const aspect = img.width / img.height;
                const h = 250;
                const w = h * aspect;
                const x = (this.canvas.width - w) / 2;
                const y = (this.canvas.height - h) / 2;
                
                ctx.drawImage(img, x, y, w, h);
                resolve(this.extractPoints(scale));
            };
            img.onerror = reject;
            img.src = imageUrl;
        });
    }

    sampleLogo(scale = 16.0) {
        const LOGO = [
            "    ########       ##      ##     ##        ##",
            "   ##########      ##      ##      ##      ## ",
            "  ###      ###     ##      ##       ##    ##  ",
            "  ###              ##      ##        ##  ##   ",
            "   ########        ##########         ####    ",
            "    #########      ##########        ####     ",
            "          ####     ##      ##       ##  ##    ",
            "  ###     ####     ##      ##      ##    ##   ",
            "   ##########      ##      ##     ##      ##  ",
            "    ########       ##      ##    ##        ## "
        ];
        this.points = [];
        const w = LOGO[0].length;
        const h = LOGO.length;
        for (let r = 0; r < h; r++) {
            for (let c = 0; c < w; c++) {
                if (LOGO[r][c] === '#') {
                    this.points.push({
                        x: (c - w/2) * scale * 0.6,
                        y: -(r - h/2) * scale,
                        z: 0
                    });
                }
            }
        }
        return this.points;
    }

    extractPoints(scale) {
        this.points = [];
        const imgData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
        // Step size 1 for maximum particle density
        for (let y = 0; y < this.canvas.height; y+=1) {
            for (let x = 0; x < this.canvas.width; x+=1) {
                const alpha = imgData[(y * this.canvas.width + x) * 4 + 3];
                if (alpha > 128) {
                    this.points.push({
                        x: (x - this.canvas.width/2) * scale,
                        y: -(y - this.canvas.height/2) * scale,
                        z: 0
                    });
                }
            }
        }
        return this.points;
    }
}
