export class TextSampler {
    constructor() {
        this.canvas = document.getElementById('sampler-canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.canvas.width = 1200;
        this.canvas.height = 400;
        this.points = [];
        this.bonkPoints = [];
        this.solanaPoints = [];
        this.shxPoints = [];
    }

    async preloadImages() {
        try {
            this.solanaPoints = await this.sampleImageAsPoints('./images/sol.png', 1.0);
        } catch(e) {
            console.log("Failed to load SOL image");
            this.solanaPoints = this.sampleToken('SOL', 1.2);
        }
        
        try {
            this.bonkPoints = await this.sampleImageAsPoints('./images/bonk.png', 1.0);
        } catch(e) {
            console.log("Failed to load BONK image");
            this.bonkPoints = this.sampleToken('BONK', 1.2);
        }
        
        // Restore the epic SHX logo
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
                
                // Center and scale image
                const maxDim = 280;
                let w = img.width;
                let h = img.height;
                if (w > h) {
                    h = (h / w) * maxDim;
                    w = maxDim;
                } else {
                    w = (w / h) * maxDim;
                    h = maxDim;
                }
                const x = (this.canvas.width - w) / 2;
                const y = (this.canvas.height - h) / 2;
                
                ctx.drawImage(img, x, y, w, h);
                resolve(this.extractPoints(scale, true));
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

    extractPoints(scale, isImage = false) {
        this.points = [];
        const imgData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
        
        // Auto-detect background color from the top-left pixel (if it's an image with solid background)
        let bgR = 0, bgG = 0, bgB = 0, bgA = 0;
        if (isImage) {
            bgR = imgData[0]; bgG = imgData[1]; bgB = imgData[2]; bgA = imgData[3];
        }

        // Step size 1 for maximum particle density
        for (let y = 0; y < this.canvas.height; y+=1) {
            for (let x = 0; x < this.canvas.width; x+=1) {
                const i = (y * this.canvas.width + x) * 4;
                const r = imgData[i];
                const g = imgData[i+1];
                const b = imgData[i+2];
                const a = imgData[i+3];
                
                let isBg = false;
                if (isImage && bgA > 250) {
                    // Check if it matches the background color
                    if (Math.abs(r - bgR) < 10 && Math.abs(g - bgG) < 10 && Math.abs(b - bgB) < 10) {
                        isBg = true;
                    }
                }

                if (a > 128 && !isBg) {
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
