export class AudioEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Final Output Chain
        this.masterCompressor = this.ctx.createDynamicsCompressor();
        this.masterCompressor.threshold.value = -12;
        this.masterCompressor.knee.value = 10;
        this.masterCompressor.ratio.value = 4; // Punchy, not completely squashed
        this.masterCompressor.attack.value = 0.03; // Slower attack lets transients (punch) through
        this.masterCompressor.release.value = 0.25;
        
        this.masterCompressor.connect(this.ctx.destination);
        
        // Video Recording Output
        this.streamDestination = this.ctx.createMediaStreamDestination();
        this.masterCompressor.connect(this.streamDestination);

        // Mix Bus (Background music and drones)
        this.mixBus = this.ctx.createGain();
        this.mixBus.gain.value = 0.5;
        
        // Ducking Bus (Creates Sidechain Pumping)
        this.duckingGain = this.ctx.createGain();
        this.duckingGain.gain.value = 1.0;
        
        this.mixBus.connect(this.duckingGain);
        this.duckingGain.connect(this.masterCompressor);

        // Impact Bus (Heavy drums that bypass ducking)
        this.impactBus = this.ctx.createGain();
        this.impactBus.gain.value = 1.0;
        this.impactBus.connect(this.masterCompressor);
        
        // Harmonic Distortion Node
        this.distortion = this.ctx.createWaveShaper();
        this.distortion.curve = this.makeDistortionCurve(15); // Smooth warmth, not brutal grit
        this.distortion.oversample = '4x';
        this.distortion.connect(this.impactBus);

        // Bitcrusher Node (8-bit smooth grit)
        this.bitcrusher = this.ctx.createWaveShaper();
        this.bitcrusher.curve = this.makeBitcrusherCurve(8);
        this.bitcrusher.connect(this.impactBus);

        // Huge Reverb
        const len = this.ctx.sampleRate * 4.0;
        const buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const d = buf.getChannelData(ch);
            for (let i = 0; i < len; i++) {
                d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
            }
        }
        this.reverb = this.ctx.createConvolver();
        this.reverb.buffer = buf;
        this.reverb.connect(this.duckingGain); // Reverb gets ducked too
        
        // Dotted 8th Note Delay for Cinematic Space
        this.delay = this.ctx.createDelay();
        this.delay.delayTime.value = (60 / 95) * 0.75; 
        this.delayFeedback = this.ctx.createGain();
        this.delayFeedback.gain.value = 0.3;
        this.delay.connect(this.delayFeedback);
        this.delayFeedback.connect(this.delay);
        this.delay.connect(this.mixBus);
        
        // Metallic Comb Filter (for robotic glitches)
        this.combFilter = this.ctx.createDelay();
        this.combFilter.delayTime.value = 0.007; // 7ms resonant delay
        this.combFeedback = this.ctx.createGain();
        this.combFeedback.gain.value = 0.85; 
        this.combFilter.connect(this.combFeedback);
        this.combFeedback.connect(this.combFilter);
        this.combFilter.connect(this.mixBus);

        // Custom "Neuro-Reese" Wavetable
        const real = new Float32Array(32);
        const imag = new Float32Array(32);
        real[0] = 0; imag[0] = 0;
        for (let i = 1; i < 32; i++) {
            real[i] = (i % 2 === 0) ? 0.8 / i : -0.4 / i;
            imag[i] = 0.5 / i;
        }
        this.cyberWave = this.ctx.createPeriodicWave(real, imag);
        
        this.droneOn = false;
        this.sequencing = false;
        this.nextNoteTime = 0;
        this.current16thNote = 0;
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

    triggerDuck(duration = 0.5, depth = 0.1, startTime = null) {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        const t = startTime !== null ? startTime : this.ctx.currentTime;
        this.duckingGain.gain.cancelScheduledValues(t);
        this.duckingGain.gain.setValueAtTime(this.duckingGain.gain.value, t);
        this.duckingGain.gain.linearRampToValueAtTime(depth, t + 0.01);
        this.duckingGain.gain.exponentialRampToValueAtTime(1.0, t + duration);
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
        for (let i = 0; i < s; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / s, 6);
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
        else outNode.connect(this.mixBus);
        
        src.start(startT);
    }

    kick() {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        this.triggerDuck(0.6, 0.1);
        
        // High frequency click for punch
        this.osc(4000, 'square', 0.01, 0.5, false, false, true); 
        
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.frequency.setValueAtTime(300, this.ctx.currentTime); // Pitch sweep starts higher
        o.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.1); // Sweeps much faster
        g.gain.setValueAtTime(1.5, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);
        o.connect(g); g.connect(this.impactBus);
        o.start(); o.stop(this.ctx.currentTime + 0.8);
        
        this.noise(0.2, 0.4, false, true);
    }

    subDrop() {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        this.triggerDuck(4.0, 0.2); 
        
        const o1 = this.ctx.createOscillator();
        const o2 = this.ctx.createOscillator();
        o1.type = 'sine'; o2.type = 'triangle';
        const g = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 4.0);
        
        o1.frequency.setValueAtTime(120, this.ctx.currentTime);
        o1.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 4.0);
        o2.frequency.setValueAtTime(120, this.ctx.currentTime);
        o2.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 4.0);
        
        g.gain.setValueAtTime(1.5, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 4.0);
        
        o1.connect(g); o2.connect(g);
        g.connect(filter); 
        
        filter.connect(this.distortion);
        filter.connect(this.impactBus); // Keep clean low end
        
        o1.start(); o2.start();
        o1.stop(this.ctx.currentTime + 4.0);
        o2.stop(this.ctx.currentTime + 4.0);
    }
    
    karplusStrong(freq, time, decay = 2.0) {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        // Physical modeling of a plucked string (Guitar/Harp)
        const delayTime = 1.0 / freq;
        
        const noiseSource = this.ctx.createBufferSource();
        const bufferSize = this.ctx.sampleRate * delayTime; // Just a tiny burst of noise
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i/bufferSize, 2);
        }
        noiseSource.buffer = buffer;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2000; // Dampen the string
        
        const delay = this.ctx.createDelay();
        delay.delayTime.value = delayTime;
        
        const feedback = this.ctx.createGain();
        feedback.gain.value = 0.99; // How long the string rings
        
        const outGain = this.ctx.createGain();
        outGain.gain.setValueAtTime(0.3, time);
        outGain.gain.exponentialRampToValueAtTime(0.001, time + decay);
        
        noiseSource.connect(filter);
        filter.connect(delay);
        delay.connect(feedback);
        feedback.connect(filter); // Loop back through filter for natural decay
        
        filter.connect(outGain);
        outGain.connect(this.reverb); // Lush space
        outGain.connect(this.mixBus);
        
        noiseSource.start(time);
    }
    
    fmPiano(freq, time) {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        // DX7-style Electric Piano / Glassy Bell
        const car = this.ctx.createOscillator();
        const mod = this.ctx.createOscillator();
        car.type = 'sine';
        mod.type = 'sine';
        
        car.frequency.setValueAtTime(freq, time);
        mod.frequency.setValueAtTime(freq * 2.01, time); // Subtle detune for metallic chime
        
        const modGain = this.ctx.createGain();
        modGain.gain.setValueAtTime(freq * 3, time); // Modulation index
        modGain.gain.exponentialRampToValueAtTime(10, time + 1.5);
        
        mod.connect(modGain);
        modGain.connect(car.frequency);
        
        const outGain = this.ctx.createGain();
        outGain.gain.setValueAtTime(0.0, time);
        outGain.gain.linearRampToValueAtTime(0.15, time + 0.02); // Soft attack
        outGain.gain.exponentialRampToValueAtTime(0.001, time + 2.5); // Long bell decay
        
        car.connect(outGain);
        outGain.connect(this.delay);
        outGain.connect(this.mixBus);
        
        mod.start(time); mod.stop(time + 2.5);
        car.start(time); car.stop(time + 2.5);
    }

    glitch() {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        // Beautiful organic wind chimes instead of harsh glitches
        const f = 1000 + Math.random()*2000;
        this.fmPiano(f, this.ctx.currentTime);
    }

    impact() {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        this.kick(); this.subDrop(); this.noise(0.8, 0.7, true, true);
        this.glitch();
        window.shakeIntensity = 45;
        this.flash('#2FF36A');
    }

    megaImpact() {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        this.triggerDuck(6.0, 0.05); // Massive silence duck
        this.kick(); this.subDrop(); this.noise(1.5, 0.9, true, true);
        this.glitch(); setTimeout(() => this.glitch(), 150);
        window.shakeIntensity = 75;
        this.flash('#ffffff');
        const notes = [55, 110, 165, 220, 330, 440];
        notes.forEach((n, i) => {
            setTimeout(() => this.osc(n, 'square', 3.0, 0.05, true, true, true), i * 50);
            setTimeout(() => this.osc(n, 'sine', 4.0, 0.1, true, false, false), i * 50);
        });
    }

    ping() {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        this.osc(800, 'sine', 0.8, 0.05, true, true);
        this.osc(1200, 'sine', 0.4, 0.03, true, true);
    }

    riser(d) {
        if (!this.ctx || this.ctx.state === 'suspended') return;
        const t = this.ctx.currentTime;
        
        // Shepard tone illusion
        const baseFreq = 55; // A1
        const numOscs = 6;
        for (let i = 0; i < numOscs; i++) {
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            const panner = this.ctx.createStereoPanner();
            
            o.type = 'sawtooth';
            // Each oscillator starts an octave apart
            const startFreq = baseFreq * Math.pow(2, i);
            const endFreq = startFreq * 4; // Rise 2 octaves
            
            o.frequency.setValueAtTime(startFreq, t);
            o.frequency.exponentialRampToValueAtTime(endFreq, t + d);
            
            // Bell curve amplitude envelope based on frequency
            g.gain.setValueAtTime(0.001, t);
            g.gain.linearRampToValueAtTime(0.2, t + (d / 2));
            g.gain.linearRampToValueAtTime(0.001, t + d);
            
            panner.pan.setValueAtTime(i % 2 === 0 ? -1.0 : 1.0, t);
            panner.pan.linearRampToValueAtTime(i % 2 === 0 ? 1.0 : -1.0, t + d);
            
            o.connect(g); g.connect(panner); panner.connect(this.reverb);
            o.start(t); o.stop(t + d);
        }
        
        // Filtered White noise sweep
        const s = this.ctx.sampleRate * d;
        const b = this.ctx.createBuffer(1, s, this.ctx.sampleRate);
        const dd = b.getChannelData(0);
        for (let i = 0; i < s; i++) dd[i] = (Math.random() * 2 - 1);
        const src = this.ctx.createBufferSource();
        src.buffer = b;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(50, t);
        filter.frequency.exponentialRampToValueAtTime(5000, t + d);
        filter.Q.value = 5.0;
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.001, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.3, t + d);
        src.connect(filter); filter.connect(noiseGain); noiseGain.connect(this.reverb);
        src.start(t); src.stop(t + d);
    }

    chord() {
        this.osc(110, 'sine', 7, 0.15, true);
        this.osc(165, 'sine', 7, 0.15, true);
        this.osc(220, 'sine', 7, 0.15, true);
        this.osc(330, 'sine', 6, 0.1, true);
        this.osc(440, 'sine', 5, 0.06, true);
    }

    startDrone() {
        if (this.droneOn) return;
        this.droneOn = true;
        const g = this.ctx.createGain();
        g.gain.value = 0;
        g.connect(this.mixBus); // Routed to mix bus so it gets ducked!
        const o1 = this.ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 40; o1.connect(g); o1.start();
        const o2 = this.ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 60; o2.connect(g); o2.start();
        g.gain.linearRampToValueAtTime(0.06, this.ctx.currentTime + 10);
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
        // Schedule notes while nextNoteTime is within 0.1 seconds
        while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
            this.scheduleNote(this.current16thNote, this.nextNoteTime);
            this.nextNoteTime += (60 / 95) / 4; // 16th note at 95 BPM
            this.current16thNote = (this.current16thNote + 1) % 16;
        }
        this.schedulerTimer = setTimeout(() => this.scheduler(), 25);
    }

    scheduleNote(step, time) {
        // Futuristic Acoustic & Cinematic Elements
        
        // Polyrhythmic FM Piano (Beautiful, glassy arpeggios)
        if (step % 3 === 0 || step === 7 || step === 14) {
            const pianoNotes = [261.63, 293.66, 329.63, 392.00, 440.00]; // C Major Pentatonic
            const pFreq = pianoNotes[(step + Math.floor(time*2)) % pianoNotes.length] * 2; // C5 range
            this.fmPiano(pFreq, time);
        }
        
        // Karplus-Strong Physical Modeled Guitar / Harp
        if (step % 4 === 0) {
            const guitarNotes = [130.81, 146.83, 164.81, 196.00]; // C3 range
            const gFreq = guitarNotes[(step / 4) % guitarNotes.length];
            // Strum effect - slight delay between notes
            this.karplusStrong(gFreq, time, 3.0);
            this.karplusStrong(gFreq * 1.5, time + 0.03, 2.5); // Perfect fifth strum
        }
        
        // Cinematic Tribal Drums
        if (step === 0) {
            // Deep, resonant Taiko drum kick
            this.triggerDuck(0.5, 0.2, time);
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(120, time);
            o.frequency.exponentialRampToValueAtTime(30, time + 0.3);
            g.gain.setValueAtTime(1.5, time);
            g.gain.exponentialRampToValueAtTime(0.001, time + 0.8);
            o.connect(g); g.connect(this.reverb); // Bathed in reverb
            g.connect(this.impactBus);
            o.start(time); o.stop(time + 0.8);
            
            // Low rumble layer
            this.noise(0.2, 0.1, false, false, time);
        }
        
        if (step === 8) {
            // Soft cinematic snare / woodblock
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            o.type = 'triangle';
            o.frequency.setValueAtTime(600, time);
            o.frequency.exponentialRampToValueAtTime(200, time + 0.1);
            g.gain.setValueAtTime(0.6, time);
            g.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
            o.connect(g); g.connect(this.reverb); g.connect(this.mixBus);
            o.start(time); o.stop(time + 0.15);
            
            this.noise(0.1, 0.2, false, false, time); // Soft shaker layer
        }
        
        // Ambient Wash (Chords swelling in the background)
        if (step === 0 || step === 8) {
            const chordRoot = (step === 0) ? 130.81 : 174.61; // C3 to F3
            const outGain = this.ctx.createGain();
            outGain.gain.setValueAtTime(0.0, time);
            outGain.gain.linearRampToValueAtTime(0.06, time + 0.5); // Swell up
            outGain.gain.linearRampToValueAtTime(0.0, time + 2.0); // Swell down
            outGain.connect(this.reverb); outGain.connect(this.mixBus);
            
            [1.0, 1.25, 1.5, 2.0].forEach(multiplier => { // Major chord voicing
                const o = this.ctx.createOscillator();
                o.type = 'sine';
                o.frequency.value = chordRoot * multiplier;
                o.connect(outGain);
                o.start(time); o.stop(time + 2.0);
            });
        }
    }
}
