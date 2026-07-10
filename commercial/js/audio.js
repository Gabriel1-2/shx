export class AudioEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Final Output Chain
        this.masterOut = this.ctx.createGain();
        this.masterOut.gain.value = 0.8; // Provide 2dB of headroom to prevent clipping
        
        // Brickwall Limiter to prevent ANY digital clipping/cracking
        this.limiter = this.ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -0.5; // Catch peaks just below 0dB
        this.limiter.knee.value = 0.0; // Hard knee (brickwall)
        this.limiter.ratio.value = 20.0; // Extreme ratio for limiting
        this.limiter.attack.value = 0.002; // Fast attack
        this.limiter.release.value = 0.05; // Fast release
        
        this.masterOut.connect(this.limiter);
        this.limiter.connect(this.ctx.destination);
        
        // Video Recording Output
        this.streamDestination = this.ctx.createMediaStreamDestination();
        this.limiter.connect(this.streamDestination);

        // Music Compressor (crushes drums and synths, but NOT the voice)
        this.masterCompressor = this.ctx.createDynamicsCompressor();
        this.masterCompressor.threshold.value = -12;
        this.masterCompressor.knee.value = 5; // Harder knee for electronic music
        this.masterCompressor.ratio.value = 8; // Heavy compression
        this.masterCompressor.attack.value = 0.01; // Fast attack
        this.masterCompressor.release.value = 0.15; // Fast release for pumping
        
        this.masterCompressor.connect(this.masterOut);

        // Mix Bus (Synths and Arps)
        this.mixBus = this.ctx.createGain();
        this.mixBus.gain.value = 0.6;
        
        // Ducking Bus (Sidechain Pumping linked to kick)
        this.duckingGain = this.ctx.createGain();
        this.duckingGain.gain.value = 1.0;
        
        this.mixBus.connect(this.duckingGain);
        this.duckingGain.connect(this.masterCompressor);

        // Impact Bus (Drums and Bass that bypass ducking)
        this.impactBus = this.ctx.createGain();
        this.impactBus.gain.value = 0.9;
        this.impactBus.connect(this.masterCompressor);
        
        // Harmonic Distortion Node
        this.distortion = this.ctx.createWaveShaper();
        this.distortion.curve = this.makeDistortionCurve(30); // Hard distortion
        this.distortion.oversample = '4x';
        this.distortion.connect(this.impactBus);

        // Bitcrusher Node (8-bit grit)
        this.bitcrusher = this.ctx.createWaveShaper();
        this.bitcrusher.curve = this.makeBitcrusherCurve(6); // Crunchier
        this.bitcrusher.connect(this.impactBus);

        // Cyberpunk Reverb (Tight, metallic)
        const len = this.ctx.sampleRate * 1.5; // Shorter reverb for fast music
        const buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const d = buf.getChannelData(ch);
            for (let i = 0; i < len; i++) {
                d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
            }
        }
        this.reverb = this.ctx.createConvolver();
        this.reverb.buffer = buf;
        
        const revGain = this.ctx.createGain();
        revGain.gain.value = 0.3;
        this.reverb.connect(revGain);
        revGain.connect(this.duckingGain);
        
        // 16th Note Ping-Pong Delay for Arpeggios
        const delayTime = (60 / 128) * 0.25; // 16th note at 128 BPM
        this.delayL = this.ctx.createDelay();
        this.delayR = this.ctx.createDelay();
        this.delayL.delayTime.value = delayTime;
        this.delayR.delayTime.value = delayTime;
        
        this.delayFeedbackL = this.ctx.createGain();
        this.delayFeedbackR = this.ctx.createGain();
        this.delayFeedbackL.gain.value = 0.4;
        this.delayFeedbackR.gain.value = 0.4;
        
        this.pannerL = this.ctx.createStereoPanner();
        this.pannerR = this.ctx.createStereoPanner();
        this.pannerL.pan.value = -0.8;
        this.pannerR.pan.value = 0.8;
        
        // Route delays to output
        this.delayL.connect(this.pannerL);
        this.delayR.connect(this.pannerR);
        this.pannerL.connect(this.mixBus);
        this.pannerR.connect(this.mixBus);
        
        // Ping-pong cross feedback (Left feeds Right, Right feeds Left)
        this.delayL.connect(this.delayFeedbackL);
        this.delayFeedbackL.connect(this.delayR);
        this.delayR.connect(this.delayFeedbackR);
        this.delayFeedbackR.connect(this.delayL);
        
        this.delayInput = this.ctx.createGain();
        this.delayInput.connect(this.delayL);
        
        // Metallic Comb Filter (for robot sounds/glitches)
        this.combFilter = this.ctx.createDelay();
        this.combFilter.delayTime.value = 0.005; // 5ms delay = metallic ringing
        this.combFeedback = this.ctx.createGain();
        this.combFeedback.gain.value = 0.9; 
        this.combFilter.connect(this.combFeedback);
        this.combFeedback.connect(this.combFilter);
        this.combFilter.connect(this.mixBus);

        this.droneOn = false;
        this.sequencing = false;
        this.nextNoteTime = 0;
        this.current16thNote = 0;
        this.bpm = 145; // EXTREME HIGH ENERGY TEMPO
    }

    makeDistortionCurve(amount) {
        const k = typeof amount === 'number' ? amount : 50,
            n_samples = 44100,
            curve = new Float32Array(n_samples),
            deg = Math.PI / 180;
        for (let i = 0; i < n_samples; ++i) {
            const x = i * 2 / n_samples - 1;
            curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }

    makeBitcrusherCurve(bits) {
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const steps = Math.pow(2, bits);
        for (let i = 0; i < n_samples; i++) {
            let x = i * 2 / n_samples - 1;
            curve[i] = Math.round(x * steps) / steps;
        }
        return curve;
    }

    triggerSidechain(time) {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        this.duckingGain.gain.cancelScheduledValues(time);
        this.duckingGain.gain.setValueAtTime(this.duckingGain.gain.value, time);
        this.duckingGain.gain.linearRampToValueAtTime(0.1, time + 0.01); // Duck heavily
        this.duckingGain.gain.exponentialRampToValueAtTime(1.0, time + 0.25); // Pump back up
    }

    osc(f, t, d, v, useReverb = false, pan = false, useDistortion = false, startTime = null) {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        const startT = startTime !== null ? startTime : this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = t;
        o.frequency.setValueAtTime(f, startT);
        g.gain.setValueAtTime(v, startT);
        g.gain.exponentialRampToValueAtTime(0.001, startT + d);
        o.connect(g);
        
        let outNode = g;
        if (pan) {
            const panner = this.ctx.createStereoPanner();
            panner.pan.value = Math.random() * 2 - 1;
            outNode.connect(panner);
            outNode = panner;
        }
        
        if (useDistortion) outNode.connect(this.distortion);
        else if (useReverb) outNode.connect(this.reverb);
        else outNode.connect(this.mixBus);
        
        o.start(startT); o.stop(startT + d);
    }

    noise(d = 0.25, v = 0.4, pan = false, useDistortion = false, startTime = null, useBitcrush = false, useComb = false) {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        const startT = startTime !== null ? startTime : this.ctx.currentTime;
        const s = this.ctx.sampleRate * d;
        const b = this.ctx.createBuffer(1, s, this.ctx.sampleRate);
        const dd = b.getChannelData(0);
        for (let i = 0; i < s; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / s, 4);
        const src = this.ctx.createBufferSource();
        src.buffer = b;
        const g = this.ctx.createGain();
        g.gain.value = v;
        src.connect(g);
        
        let outNode = g;
        if (pan) {
            const panner = this.ctx.createStereoPanner();
            panner.pan.value = Math.random() * 2 - 1;
            outNode.connect(panner);
            outNode = panner;
        }
        
        if (useComb) outNode.connect(this.combFilter);
        else if (useBitcrush) outNode.connect(this.bitcrusher);
        else if (useDistortion) outNode.connect(this.distortion);
        else outNode.connect(this.impactBus);
        
        src.start(startT);
    }

    kick(time = null) {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        const t = time !== null ? time : this.ctx.currentTime;
        this.triggerSidechain(t); // Sidechain pumping
        
        // Time Warp - slows down visual simulation on the beat
        window.timeWarp = 0.2;
        
        // Synchronized physical camera shake
        const delay = Math.max(0, t - this.ctx.currentTime);
        setTimeout(() => { window.shakeIntensity = 25; }, delay * 1000);
        
        // High frequency transient click for attack
        this.osc(3000, 'square', 0.01, 0.4, false, false, true, t); 
        
        // Heavy body punch
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(150, t); 
        o.frequency.exponentialRampToValueAtTime(40, t + 0.1); // Fast punch drop
        
        g.gain.setValueAtTime(1.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        
        o.connect(g); g.connect(this.distortion); // Distorted kick
        
        o.start(t); o.stop(t + 0.2);
        
        // Dedicated SUB BASS (clean, ultra low rumble)
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(45, t);
        sub.frequency.exponentialRampToValueAtTime(30, t + 0.6); // Massive sub tail
        subGain.gain.setValueAtTime(1.5, t);
        subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        sub.connect(subGain);
        subGain.connect(this.masterCompressor); // Bypass distortion for pure sub power
        sub.start(t); sub.stop(t + 0.6);
    }

    cyberSnare(time = null) {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        const t = time !== null ? time : this.ctx.currentTime;
        
        // Synchronized physical camera shake
        const delay = Math.max(0, t - this.ctx.currentTime);
        setTimeout(() => { window.shakeIntensity = 15; }, delay * 1000);
        
        // Low body punch
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(200, t);
        o.frequency.exponentialRampToValueAtTime(100, t + 0.1);
        g.gain.setValueAtTime(1.0, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        o.connect(g); g.connect(this.impactBus);
        o.start(t); o.stop(t + 0.2);
        
        // Distorted Noise burst
        this.noise(0.25, 0.8, false, true, t);
        // Bitcrushed tail
        this.noise(0.4, 0.4, true, false, t, true);
    }

    supernovaImpact(time = null) {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        const t = time !== null ? time : this.ctx.currentTime;
        
        // Earth-shattering screen shake
        const delay = Math.max(0, t - this.ctx.currentTime);
        setTimeout(() => { window.shakeIntensity = 100; }, delay * 1000);
        
        // Massive low-end explosion
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(150, t);
        sub.frequency.exponentialRampToValueAtTime(20, t + 2.0); // Slow bass drop
        subGain.gain.setValueAtTime(2.5, t);
        subGain.gain.exponentialRampToValueAtTime(0.001, t + 4.0); // 4 second tail
        sub.connect(subGain);
        subGain.connect(this.masterCompressor); 
        sub.start(t); sub.stop(t + 4.0);
        
        // Huge distorted noise explosion
        const nSize = this.ctx.sampleRate * 4.0;
        const nBuf = this.ctx.createBuffer(1, nSize, this.ctx.sampleRate);
        const nd = nBuf.getChannelData(0);
        for(let i=0; i<nSize; i++) {
            nd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nSize, 2);
        }
        const nSrc = this.ctx.createBufferSource();
        nSrc.buffer = nBuf;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(8000, t);
        filter.frequency.exponentialRampToValueAtTime(100, t + 3.0); // Filter sweep down
        
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(1.5, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 4.0);
        
        nSrc.connect(filter);
        filter.connect(nGain);
        nGain.connect(this.distortion); // Extremely distorted explosion
        
        nSrc.start(t);
    }

    acidBass(freq, time, duration = 0.2) {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        // Classic 303-style acid bass
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(freq, time);
        
        if (duration > 0.2) {
            o.frequency.exponentialRampToValueAtTime(freq * 0.5, time + duration);
        }
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = 18; // Higher resonance for more squelch
        
        // Envelope sweeping the filter
        filter.frequency.setValueAtTime(5000, time);
        filter.frequency.exponentialRampToValueAtTime(80, time + duration * 0.75);
        
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.9, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + duration); // Tight sequence
        
        o.connect(filter);
        filter.connect(g);
        g.connect(this.impactBus); // Bypasses ducking for raw power
        
        o.start(time); o.stop(time + duration);
    }

    arpSynth(freq, time) {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        // Fast, plucky synthwave arpeggios with Haas Stereo Widening
        const o1 = this.ctx.createOscillator();
        const o2 = this.ctx.createOscillator();
        o1.type = 'square';
        o2.type = 'sawtooth';
        o1.frequency.setValueAtTime(freq, time);
        o2.frequency.setValueAtTime(freq * 1.01, time); // Detuned for width
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, time);
        filter.frequency.exponentialRampToValueAtTime(500, time + 0.1);
        
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.15, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
        
        o1.connect(filter); o2.connect(filter);
        filter.connect(g);
        
        // Haas Stereo Widening (delaying right channel by 12ms)
        const haasDelay = this.ctx.createDelay();
        haasDelay.delayTime.value = 0.012; // 12ms
        const pannerL = this.ctx.createStereoPanner();
        const pannerR = this.ctx.createStereoPanner();
        pannerL.pan.value = -0.5;
        pannerR.pan.value = 0.5;
        
        g.connect(pannerL); // Direct to left
        g.connect(haasDelay); // Delayed to right
        haasDelay.connect(pannerR);
        
        pannerL.connect(this.delayInput); // Feeds into ping-pong delay
        pannerR.connect(this.delayInput);
        pannerL.connect(this.duckingGain); // Gets sidechained
        pannerR.connect(this.duckingGain);
        
        o1.start(time); o1.stop(time + 0.15);
        o2.start(time); o2.stop(time + 0.15);
    }

    ping(time = null) {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        const t = time !== null ? time : this.ctx.currentTime;
        this.osc(2000, 'sine', 0.1, 0.1, true, false, false, t);
        this.osc(4000, 'sine', 0.05, 0.05, true, false, false, t);
    }

    riser(duration) {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        const t = this.ctx.currentTime;
        
        // FM Synthesis Riser (Carrier + Modulator)
        const carrier = this.ctx.createOscillator();
        const modulator = this.ctx.createOscillator();
        const modGain = this.ctx.createGain();
        const mainGain = this.ctx.createGain();
        
        carrier.type = 'sine';
        modulator.type = 'sawtooth';
        
        // Pitch sweep
        carrier.frequency.setValueAtTime(50, t);
        carrier.frequency.exponentialRampToValueAtTime(8000, t + duration);
        modulator.frequency.setValueAtTime(50, t);
        modulator.frequency.exponentialRampToValueAtTime(8000, t + duration);
        
        // FM Depth sweep (gets more distorted and terrifying as it rises)
        modGain.gain.setValueAtTime(100, t);
        modGain.gain.exponentialRampToValueAtTime(5000, t + duration);
        
        modulator.connect(modGain);
        modGain.connect(carrier.frequency); // FM modulation
        
        mainGain.gain.setValueAtTime(0.01, t);
        mainGain.gain.linearRampToValueAtTime(0.8, t + duration); // Louder
        mainGain.gain.linearRampToValueAtTime(0.001, t + duration + 0.1);
        
        carrier.connect(mainGain);
        mainGain.connect(this.distortion); // Rip it through distortion
        
        modulator.start(t); modulator.stop(t + duration + 0.1);
        carrier.start(t); carrier.stop(t + duration + 0.1);
    }
    
    tranceChord(freq, time, duration=0.2) {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        // High-energy supersaw stab
        const detune = [0, -12, 12, -24, 24]; // 5 saw waves slightly detuned
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.2, time); // Lower volume to sit in mix
        g.gain.exponentialRampToValueAtTime(0.001, time + duration);
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(4000, time);
        filter.frequency.exponentialRampToValueAtTime(300, time + duration);
        
        detune.forEach(cents => {
            const o = this.ctx.createOscillator();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(freq, time);
            o.detune.setValueAtTime(cents, time);
            o.connect(filter);
            o.start(time); o.stop(time + duration);
        });
        
        filter.connect(g);
        g.connect(this.reverb); // Big stadium sound
        g.connect(this.impactBus); // Hit the compressor
    }

    chord() {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        const t = this.ctx.currentTime;
        [55, 65.41, 82.41].forEach(freq => {
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            o.type = 'square';
            o.frequency.setValueAtTime(freq, t);
            g.gain.setValueAtTime(0.3, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 4.0);
            o.connect(g); g.connect(this.reverb);
            o.start(t); o.stop(t + 4.0);
        });
    }

    glitch() {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        const f = 100 + Math.random()*2000;
        this.osc(f, 'square', 0.05, 0.3, false, true, true);
        this.noise(0.05, 0.4, true, false, null, false, true); // Comb filtered noise
    }

    impact() {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        this.kick(); 
        this.noise(0.8, 0.7, true, true);
        this.glitch();
        window.shakeIntensity = 45;
        this.flash('#2FF36A');
    }

    megaImpact() {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        const t = this.ctx.currentTime;
        this.triggerSidechain(t); // Huge duck
        this.kick(t); 
        this.noise(2.0, 1.0, true, true);
        this.glitch(); setTimeout(() => this.glitch(), 100);
        window.shakeIntensity = 200; // EXTREME SHATTER SHAKE
        this.flash('#ffffff');
        
        this.braam(t);
        
        // --- V6 CRYPTO INSANITY: SUB BASS NUKE ---
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(30, t); // Super low sub
        o.frequency.exponentialRampToValueAtTime(10, t + 4.0); // Drop to inaudible
        
        g.gain.setValueAtTime(4.0, t); // OVERDRIVE GAIN
        g.gain.exponentialRampToValueAtTime(0.01, t + 4.0);
        
        o.connect(g);
        g.connect(this.distortion); // Destroy the mix
        o.start(t); o.stop(t + 4.0);
    }

    braam(time = null) {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        const t = time !== null ? time : this.ctx.currentTime;
        
        // Layered Detuned Sawtooths for massive brass/horn sound
        const freqs = [55.00, 55.50, 54.50, 110.00, 111.00]; 
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = 5;
        
        // Brass envelope
        filter.frequency.setValueAtTime(200, t);
        filter.frequency.exponentialRampToValueAtTime(4000, t + 0.5);
        filter.frequency.exponentialRampToValueAtTime(100, t + 4.0);
        
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.01, t);
        g.gain.exponentialRampToValueAtTime(2.5, t + 0.1); // Swell in
        g.gain.exponentialRampToValueAtTime(0.001, t + 4.0); // Fade out
        
        freqs.forEach(freq => {
            const o = this.ctx.createOscillator();
            o.type = 'sawtooth';
            o.frequency.value = freq;
            o.connect(filter);
            o.start(t); o.stop(t + 4.0);
        });
        
        filter.connect(g);
        g.connect(this.distortion); // Heavily distorted
        g.connect(this.reverb); // Huge space
    }

    blackHoleSuck(time = null) {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        const t = time !== null ? time : this.ctx.currentTime;
        
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(40, t);
        o.frequency.exponentialRampToValueAtTime(2000, t + 6.5); // Sweeps up rapidly
        
        g.gain.setValueAtTime(0.01, t);
        g.gain.exponentialRampToValueAtTime(3.0, t + 6.5); // Gets insanely loud
        g.gain.linearRampToValueAtTime(0.001, t + 6.6); // Instant cut
        
        o.connect(g);
        g.connect(this.distortion);
        
        o.start(t); o.stop(t + 6.6);
        
        // Pitch shifted noise
        this.noise(6.5, 1.0, true, true, t, false, true);
    }

    startDrone() {
        if (this.droneOn) return;
        this.droneOn = true;
        const g = this.ctx.createGain();
        g.gain.value = 0;
        
        // Huge cinematic Reese Pad
        const freqs = [41.20, 41.50, 40.90, 82.41, 82.90]; // Multi-octave detuned E
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400; 
        
        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.1; // Slow sweep
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 800; // Deep sweep range
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        lfo.start();
        
        g.connect(filter);
        filter.connect(this.duckingGain); // Gets sidechained for massive pumping
        filter.connect(this.reverb); // Bathed in reverb
        
        freqs.forEach(f => {
            const o = this.ctx.createOscillator();
            o.type = 'sawtooth';
            o.frequency.value = f;
            o.connect(g);
            o.start();
        });
        
        g.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + 10);
    }

    flash(col) {
        const FL = document.getElementById('flash');
        if(!FL) return;
        FL.style.background = col;
        FL.style.opacity = '0.7';
        setTimeout(() => FL.style.opacity = '0.25', 30);
        setTimeout(() => FL.style.opacity = '0.08', 80);
        setTimeout(() => FL.style.opacity = '0', 180);
    }
    
    laserSweep() {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(4000, t);
        o.frequency.exponentialRampToValueAtTime(100, t + 0.3); // rapid pitch drop
        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
        o.connect(g);
        g.connect(this.distortion); // heavily distorted
        o.start(t);
        o.stop(t + 0.4);
    }

    fmBass(freq, time) {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        
        // FM Synthesis: Modulator -> Carrier
        const carrier = this.ctx.createOscillator();
        const modulator = this.ctx.createOscillator();
        const modGain = this.ctx.createGain();
        const outGain = this.ctx.createGain();
        
        carrier.type = 'sine';
        modulator.type = 'square';
        
        carrier.frequency.setValueAtTime(freq, time);
        modulator.frequency.setValueAtTime(freq * 0.5, time); // Sub-octave modulation
        
        modGain.gain.setValueAtTime(freq * 2.0, time); // High modulation index
        modGain.gain.exponentialRampToValueAtTime(10.0, time + 0.2); // Decay modulation
        
        modulator.connect(modGain);
        modGain.connect(carrier.frequency); // Frequency modulate the carrier
        
        outGain.gain.setValueAtTime(0.8, time);
        outGain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
        
        carrier.connect(outGain);
        outGain.connect(this.distortion); // Run FM through distortion
        
        modulator.start(time); modulator.stop(time + 0.3);
        carrier.start(time); carrier.stop(time + 0.3);
    }

    startSequencer() {
        if (this.sequencing) return;
        this.sequencing = true;
        this.nextNoteTime = this.ctx.currentTime + 0.1;
        this.current16thNote = 0;
        this.scheduler();
    }

    stopSequencer() {
        this.sequencing = false;
        if (this.schedulerTimer) clearTimeout(this.schedulerTimer);
    }

    scheduler() {
        if (!this.sequencing) return;
        while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
            this.scheduleNote(this.current16thNote, this.nextNoteTime);
            this.nextNoteTime += (60 / this.bpm) / 4; // 16th note timing
            this.current16thNote = (this.current16thNote + 1) % 16;
        }
        this.schedulerTimer = setTimeout(() => this.scheduler(), 25);
    }

    scheduleNote(step, time) {
        const phase = this.currentPhase || 0;
        
        // Helper arrays
        const bassNotes = [41.20, 49.00, 55.00, 61.74, 73.42]; 
        const arpNotes = [329.63, 392.00, 440.00, 493.88, 587.33]; 
        
        // Action minor chord progression (C3, Eb3, F3, C3)
        const chordProgression = [130.81, 155.56, 174.61, 130.81]; 
        const currentChord = chordProgression[Math.floor(time / 2) % 4];
        
        // RELENTLESS 16TH NOTE ARPEGGIATOR (Plays across all phases!)
        if (phase !== 5 && phase !== 6) {
            const arpIndex = (step + Math.floor(time * 4)) % arpNotes.length;
            if (step % 2 !== 0) this.arpSynth(arpNotes[arpIndex], time); // Off-beat arp
        }

        // --- PHASE 0: INTRO (0s - 5s) ---
        if (phase === 0) {
            if (step % 4 === 0) {
                // Heartbeat pulse instead of heavy kick
                const o = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                o.frequency.setValueAtTime(50, time);
                o.frequency.exponentialRampToValueAtTime(30, time + 0.3);
                g.gain.setValueAtTime(0.5, time);
                g.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
                o.connect(g); g.connect(this.masterCompressor);
                o.start(time); o.stop(time + 0.3);
            }
            if (step % 2 === 0) {
                this.noise(0.05, 0.1, true, false, time); // Fast ticking
            }
            if (step === 0) this.tranceChord(currentChord, time, 1.0); // Ominous pad
        }
        
        // --- PHASE 2-3: MAIN DROP (13s - 31s) ---
        else if (phase === 2 || phase === 3) {
            // Relentless 4-on-the-floor
            if (step % 4 === 0) this.kick(time);
            if (step === 4 || step === 12) this.cyberSnare(time);
            
            // Fast hi-hats
            if (step % 2 !== 0) this.noise(0.05, 0.1, true, false, time);
            else this.noise(0.1, 0.2, true, false, time);
            
            // MASSIVE SYNTHWAVE CHORDS (Trance gate style)
            if (step % 2 === 0) {
                this.tranceChord(currentChord * 2, time, 0.2);
            }
            if (step === 14) this.tranceChord(currentChord * 2, time, 0.4); // Syncopated hit
            
            // Rolling acid bassline
            if (step % 2 === 0 || step === 3 || step === 7 || step === 11 || step === 15) {
                let n = bassNotes[Math.floor(time * 2) % bassNotes.length];
                this.acidBass(n, time, 0.25);
            }
        }
        
        // --- PHASE 5: BREAKDOWN / THE STOP (40s - 47s) ---
        else if (phase === 5) {
            // No drums. Massive cinematic pads.
            if (step === 0) {
                this.tranceChord(currentChord, time, 2.0); // 2-second huge pad wash
                this.noise(3.0, 0.1, true, true, time, true, true); // Eerie wind
            }
            if (step % 4 === 0) {
                const arpIndex = (step + Math.floor(time * 2)) % arpNotes.length;
                this.arpSynth(arpNotes[arpIndex] * 0.5, time); // Ominous slow arp
            }
        }
        
        // --- PHASE 1 & 4: FAST DRIVE (Speed / Tunnel) ---
        else if (phase === 1 || phase === 4) {
            // Heavy 4 on the floor + FM Bass
            if (step % 4 === 0) this.kick(time);
            if (step === 4 || step === 12) this.cyberSnare(time);
            
            // Relentless syncopated FM Bass
            if (step % 2 !== 0) {
                this.fmBass(bassNotes[0], time);
            }
            
            // Super fast hi-hats
            this.noise(0.05, 0.15, true, false, time);
            
            // HYPER SPEED PUMPING CHORDS
            if (step % 4 === 2) {
                this.tranceChord(currentChord * 4, time, 0.15); // Upbeat off-beat stab
            }
            
            // Mechanical glitch stutter
            if (step === 14 || step === 15) {
                this.noise(0.02, 0.3, true, false, time);
            }
        }
        
        // --- PHASE 6: BUILD-UP (47s - 53s) ---
        else if (phase === 6) {
            // Accelerating snare roll
            const buildProg = Math.min(Math.max((time - 47.0) / 6.0, 0.0), 1.0); 
            
            // Snares get faster
            let playSnare = false;
            if (buildProg < 0.5 && step % 4 === 0) playSnare = true;
            else if (buildProg >= 0.5 && buildProg < 0.75 && step % 2 === 0) playSnare = true;
            else if (buildProg >= 0.75) playSnare = true;
            
            if (playSnare) {
                this.cyberSnare(time);
                // Ramping pitch synth
                this.osc(400 + (buildProg * 2000), 'sawtooth', 0.1, 0.4, false, true, true, time);
            }
            
            if (step === 0) this.tranceChord(currentChord, time, 1.0); // Anchor chords
            if (step === 0 || step === 8) this.kick(time);
        }
        
        // --- PHASE 7: SUPERNOVA FINALE (53s+) ---
        else if (phase === 7) {
            // ALL OUT WAR - Every instrument firing!
            if (step % 4 === 0) this.kick(time);
            if (step === 4 || step === 12) this.cyberSnare(time);
            
            // Trap hats non-stop
            this.noise(0.05, 0.25, true, false, time);
            
            // Machine gun bass + FM
            if (step % 2 === 0) {
                this.acidBass(bassNotes[0] * 0.5, time, 0.15); // Deep sub octave
            }
            
            // Massive euphoric chord stabs
            if (step % 4 === 0 || step === 6 || step === 10 || step === 14) {
                this.tranceChord(currentChord * 2, time, 0.3);
            }
            
            // Chaotic arps
            const arpIndex = Math.floor(Math.random() * arpNotes.length);
            this.arpSynth(arpNotes[arpIndex], time);
            if (Math.random() > 0.5) this.arpSynth(arpNotes[arpIndex] * 2, time + 0.05);
        }
    }
}
