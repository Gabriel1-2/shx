export class VoiceSynth {
    constructor(audioCtx, destinationNode) {
        this.ctx = audioCtx;
        this.destination = destinationNode;
        this.queue = [];
        this.speaking = false;
        this.cache = new Map();
    }

    say(text, timeTarget) {
        // Pre-fetch the audio file for gapless playback
        const filename = btoa(text).replace(/=/g, '') + '.mp3';
        const url = `audio/${filename}`;
        
        if (!this.cache.has(text)) {
            this.cache.set(text, fetch(url)
                .then(res => {
                    if (!res.ok) throw new Error("Audio file not found: " + url);
                    return res.arrayBuffer();
                })
                .then(arrayBuffer => this.ctx.decodeAudioData(arrayBuffer))
                .catch(e => console.error("Voice load error:", e))
            );
        }

        this.queue.push({ text: text, timeTarget, done: false });
    }

    update(currentTime) {
        for (let v of this.queue) {
            if (!v.done && currentTime >= v.timeTarget) {
                v.done = true;
                this._speak(v.text);
            }
        }
    }
    
    reset() {
        this.queue.forEach(v => v.done = false);
    }

    async _speak(text) {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        
        try {
            const bufferPromise = this.cache.get(text);
            if (!bufferPromise) return;
            
            const buffer = await bufferPromise;
            if (!buffer) return;
            
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            
            // Clean playback (no pitch shifting, no distortion, no ring modulation)
            // Just the pure AI voice played through the AudioContext so the recorder captures it!
            source.playbackRate.value = 1.0; 
            
            // A tiny EQ adjustment just to make sure it cuts through the music
            const highpass = this.ctx.createBiquadFilter();
            highpass.type = 'highpass';
            highpass.frequency.value = 80;
            
            const masterGain = this.ctx.createGain();
            masterGain.gain.value = 1.1; // Reduced from 1.5 to prevent limiter clipping
            
            source.connect(highpass);
            highpass.connect(masterGain);
            masterGain.connect(this.destination);
            
            source.start();
        } catch(e) {
            console.error("Audio playback error:", e);
        }
    }
}
