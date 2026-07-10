import { vsSource, fsSource, postVsSource, postFsSource } from './shaders.js?v=12';
import { GLEngine } from './gl-engine.js?v=12';
import { ParticleSystem } from './particles.js?v=12';
import { TextSampler } from './text-sampler.js?v=12';
import { AudioEngine } from './audio.js?v=12';
import { VoiceSynth } from './voice.js?v=12';
import { Timeline } from './timeline.js?v=12';

let running = false;
let lastT = 0;
let time = 0;
window.timeWarp = 1.0;

let glEngine, particles, textSampler, audio, voice, timeline;
let hudCtx, hudCanvas;

window.solanaSeed = Math.random();

async function fetchSolanaBlockhash() {
    try {
        const res = await fetch("https://api.mainnet-beta.solana.com", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({jsonrpc:"2.0", id:1, method:"getLatestBlockhash"})
        });
        const data = await res.json();
        const hashStr = data.result.value.blockhash;
        
        let seed = 0;
        for(let i=0; i<8; i++) {
            seed += hashStr.charCodeAt(i) * Math.pow(10, i);
        }
        window.solanaSeed = (seed % 10000) / 10000.0;
        console.log("Solana Hash Injected:", hashStr, "Seed:", window.solanaSeed);
    } catch(e) {
        console.log("Failed to fetch Solana hash, using default");
    }
}

let camZoom = 500;
let camRotX = 0;
let camRotY = 0;

function initHUD() {
    hudCanvas = document.getElementById('hud-canvas');
    hudCanvas.style.opacity = 0; // Hide from DOM, render strictly through WebGL Distortion Field!
    hudCtx = hudCanvas.getContext('2d');
    const resizeHud = () => {
        hudCanvas.width = innerWidth * devicePixelRatio;
        hudCanvas.height = innerHeight * devicePixelRatio;
        hudCanvas.style.width = innerWidth + 'px';
        hudCanvas.style.height = innerHeight + 'px';
        hudCtx.scale(devicePixelRatio, devicePixelRatio);
        
        // Use the new Google Font
        hudCtx.font = "bold 14px 'Share Tech Mono', monospace";
        hudCtx.textBaseline = "top";

        for (let t of timeline.texts) {
            if (t.text.includes("ENTERING")) {
                t.x = innerWidth/2;
                t.y = innerHeight/2 - 20;
                t.align = "center";
            } else if (t.text.includes("S H U L E V I T Z")) {
                t.x = innerWidth/2;
                t.y = innerHeight/2 + 60;
                t.align = "center";
                t.font = "'Rajdhani', sans-serif"; // Premium title font
                t.size = 28;
            } else if (t.text.includes("Next Era of")) {
                t.x = innerWidth/2;
                t.y = innerHeight/2 + 110;
                t.align = "center";
            } else if (t.text.includes("Built for")) {
                t.x = innerWidth/2;
                t.y = innerHeight/2 + 140;
                t.align = "center";
            } else if (t.text.includes("shx.exchange")) {
                t.x = innerWidth/2;
                t.y = innerHeight/2 + 200;
                t.align = "center";
                t.font = "'Orbitron', sans-serif"; // Very techy URL font
                t.size = 20;
            } else {
                t.x = 40 + (innerWidth > 800 ? 60 : 0);
            }
        }
    };
    resizeHud();
    window.addEventListener('resize', resizeHud);
}

function drawHUD(phase) {
    hudCtx.clearRect(0, 0, innerWidth, innerHeight);
    
    // Abstract Tech Borders and Accents
    hudCtx.strokeStyle = 'rgba(47,243,106,0.15)';
    hudCtx.lineWidth = 1;
    
    // Corner brackets
    const m = 20; const L = 40;
    hudCtx.beginPath();
    // Top Left
    hudCtx.moveTo(m, m+L); hudCtx.lineTo(m, m); hudCtx.lineTo(m+L, m);
    // Top Right
    hudCtx.moveTo(innerWidth-m-L, m); hudCtx.lineTo(innerWidth-m, m); hudCtx.lineTo(innerWidth-m, m+L);
    // Bottom Left
    hudCtx.moveTo(m, innerHeight-m-L); hudCtx.lineTo(m, innerHeight-m); hudCtx.lineTo(m+L, innerHeight-m);
    // Bottom Right
    hudCtx.moveTo(innerWidth-m-L, innerHeight-m); hudCtx.lineTo(innerWidth-m, innerHeight-m); hudCtx.lineTo(innerWidth-m, innerHeight-m-L);
    hudCtx.stroke();

    hudCtx.fillStyle = 'rgba(47,243,106,0.8)';
    hudCtx.font = "16px 'Share Tech Mono', monospace";
    hudCtx.textAlign = "right";
    hudCtx.fillText("SHX_CORE_SYS v7.2.0", innerWidth - 30, 30);
    
    // Animated Block Hash Simulator
    let blockNum = (2847300 + Math.floor(time * 12)).toString();
    hudCtx.fillText(`SEQ_NODE: ${blockNum.substring(0,3)}.${blockNum.substring(3)}`, innerWidth - 30, 50);
    
    let s = Math.floor(time);
    let ms = Math.floor((time % 1) * 100);
    hudCtx.fillText(`T+${s.toString().padStart(2,'0')}:${ms.toString().padStart(2,'0')}`, innerWidth - 30, 70);

    hudCtx.textAlign = "left";
    hudCtx.fillStyle = '#2FF36A';
    hudCtx.font = "bold 20px 'Orbitron', sans-serif";
    hudCtx.fillText("[ SHX ]", 30, 30);
    
    hudCtx.fillStyle = 'rgba(255,255,255,0.6)';
    hudCtx.font = "14px 'Share Tech Mono', monospace";
    hudCtx.fillText("SOLANA MAINNET // SECURE", 30, 54);

    if (Math.random() < 0.03) {
        hudCtx.fillStyle = 'rgba(47,243,106,0.15)';
        hudCtx.fillRect(0, Math.random() * innerHeight, innerWidth, Math.random() * 10 + 2);
    }

    // Dynamic vertical data scroll
    if (Math.random() < 0.4) {
        hudCtx.fillStyle = 'rgba(47,243,106,0.2)';
        const slangs = [
            "[ WAGMI_PROTOCOL_ACTIVE ]",
            "[ LIQUIDATION_ENGINE_BYPASSED ]",
            "[ ALPHA_LEAK_DETECTED ]",
            "[ PUMP_FUN_ROUTING_SECURED ]",
            "[ DIAMOND_HANDS_OVERRIDE ]",
            "[ GOD_CANDLE_INITIATED ]",
            "[ BEAR_MARKET_DESTROYED ]",
            "[ SHX_TO_THE_MOON ]"
        ];
        
        let hex = Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0').toUpperCase();
        let txt = `0x${hex}`;
        if (Math.random() < 0.15) txt = slangs[Math.floor(Math.random() * slangs.length)];
        
        hudCtx.fillText(txt, 30, innerHeight - 50 - Math.random() * 250);
    }

    for (let t of timeline.texts) {
        let textPhase = 0;
        if (t.timeTarget >= 5 && t.timeTarget < 13) textPhase = 1;
        else if (t.timeTarget >= 13 && t.timeTarget < 22) textPhase = 2;
        else if (t.timeTarget >= 22 && t.timeTarget < 31) textPhase = 3;
        else if (t.timeTarget >= 31 && t.timeTarget < 40) textPhase = 4;
        else if (t.timeTarget >= 40 && t.timeTarget < 47) textPhase = 5;
        else if (t.timeTarget >= 47 && t.timeTarget < 53) textPhase = 6;
        else if (t.timeTarget >= 53) textPhase = 7;

        if (textPhase !== phase && textPhase !== 7) continue; // Phase 7 stays forever

        if (time >= t.timeTarget) {
            let e = time - t.timeTarget;
            let prog = Math.min(e / t.duration, 1);
            let res = Math.floor(prog * t.text.length);
            
            let chars = '!@#$%^&*+-=|/<>?01234ABCDEFGXYZ';
            let str = "";
            for (let i = 0; i < t.text.length; i++) {
                if (i < res) str += t.text[i];
                else if (e > 0.02) str += chars[Math.floor(Math.random() * chars.length)];
                else str += " ";
            }
            
            if (res > 0 && res < t.text.length && Math.floor(time * 6) % 2 === 0) {
                str += "_";
            }
            
            
            let scaleFactor = Math.min(1.0, innerWidth / 600);
            hudCtx.fillStyle = t.color || '#2FF36A';
            if (t.color === '#ffffff') hudCtx.fillStyle = '#ffffff';
            
            const fontName = t.font || "'Share Tech Mono', monospace";
            hudCtx.font = `${t.font ? 'bold' : ''} ${(t.size || 16) * scaleFactor}px ${fontName}`;
            
            if (t.align === "center") {
                hudCtx.textAlign = "center";
            } else {
                hudCtx.textAlign = "left";
                // Render a cool block cursor instead of simple underscore
                if (res > 0 && res < t.text.length) {
                    hudCtx.fillRect(t.x + hudCtx.measureText(str).width + 5, t.y, 8, 14);
                }
            }
            
            // Drop shadow for text readability
            hudCtx.shadowColor = 'rgba(0,0,0,0.8)';
            hudCtx.shadowBlur = 4;
            hudCtx.shadowOffsetX = 2;
            hudCtx.shadowOffsetY = 2;
            
            // RGB Split Text Glitch Effect during high tension
            if (window.shakeIntensity > 15 || (res > 0 && Math.random() < 0.05)) {
                let offset = Math.random() * 5 + window.shakeIntensity * 0.1;
                hudCtx.fillStyle = 'rgba(255, 0, 100, 0.8)';
                hudCtx.fillText(str, t.x - offset, t.y);
                hudCtx.fillStyle = 'rgba(0, 200, 255, 0.8)';
                hudCtx.fillText(str, t.x + offset, t.y);
            }
            
            hudCtx.fillStyle = t.color || '#2FF36A';
            if (t.color === '#ffffff') hudCtx.fillStyle = '#ffffff';
            hudCtx.fillText(str, t.x, t.y);
            
            // Reset shadow
            hudCtx.shadowColor = 'transparent';
            hudCtx.shadowBlur = 0;
            hudCtx.shadowOffsetX = 0;
            hudCtx.shadowOffsetY = 0;
            
            if (t.lastRes !== res) {
                if (res > 0 && res < t.text.length) {
                    audio.osc(200+Math.random()*600, 'square', 0.02, 0.003);
                }
                t.lastRes = res;
            }
        }
    }
    
    // Recording indicator with elapsed time
    if (window.globalRecorder && window.globalRecorder.state === "recording") {
        // Pulsing red dot
        let pulse = 0.5 + Math.sin(time * 4) * 0.5;
        hudCtx.fillStyle = `rgba(255, 0, 0, ${0.6 + pulse * 0.4})`;
        hudCtx.beginPath();
        hudCtx.arc(innerWidth - 25, 90, 6 + pulse * 2, 0, Math.PI * 2);
        hudCtx.fill();
        
        // REC label + elapsed time
        let recSec = Math.floor(time);
        let recMin = Math.floor(recSec / 60);
        recSec = recSec % 60;
        hudCtx.fillStyle = 'rgba(255, 80, 80, 0.9)';
        hudCtx.font = "bold 14px 'Share Tech Mono', monospace";
        hudCtx.textAlign = 'right';
        hudCtx.fillText(`● REC ${recMin}:${recSec.toString().padStart(2, '0')} / 2:15`, innerWidth - 40, 95);
    }
    
    // Upload HUD to WebGL for Reality Distortion Field
    if (particles && particles.updateHudTexture) {
        particles.updateHudTexture(hudCanvas);
    }
}

function render(ts) {
    if (!running) return;
    let dt = (ts - lastT) / 1000;
    lastT = ts;
    
    if (window.timeWarp < 1.0) {
        window.timeWarp += dt * 2.0; 
        if (window.timeWarp > 1.0) window.timeWarp = 1.0;
    }
    
    time += dt * window.timeWarp;
    
    // Accurately stop recording when the visual timeline reaches 62 seconds
    if (window.globalRecorder && time > 62.0) {
        if (window.globalRecorder.state === "recording") {
            window.globalRecorder.stop();
            console.log("Recording successfully stopped at exactly 62 visual seconds.");
        }
        window.globalRecorder = null;
    }

    if (window.shakeIntensity > 0.5) window.shakeIntensity *= 0.86;
    else window.shakeIntensity = 0;

    // Calculate Audio Reactance for Synesthesia (Chromatic Aberration & Film Grain)
    window.audioReact = 0.0;
    if (audio && audio.analyser) {
        const data = new Uint8Array(audio.analyser.frequencyBinCount);
        audio.analyser.getByteFrequencyData(data);
        window.audioReact = Math.pow((data[0] + data[1] + data[2] + data[3]) / (4.0 * 255.0), 2.0); // Exponential reaction
    }

    const state = timeline.update(time, particles, textSampler);
    
    // Sync audio arrangement with visual phase
    if (audio) {
        audio.currentPhase = state.phase;
    }
    
    // Map new 60s 7-phase timeline back to the original 14-phase visual geometries
    let visualPhase = state.phase;
    if (state.phase === 0) visualPhase = 1; // Chaos
    else if (state.phase === 1) visualPhase = 2; // Jupiter
    else if (state.phase === 2) visualPhase = 4; // Tokens
    else if (state.phase === 3) visualPhase = 6; // Mobius
    else if (state.phase === 4) visualPhase = 10; // Tunnel
    else if (state.phase === 5) visualPhase = 12; // Blackhole
    else if (state.phase === 6) visualPhase = 13; // Wall Push
    else if (state.phase === 7) visualPhase = 14; // SHX Logo

    camRotX = 0;
    camRotY = 0;
    
    if (visualPhase === 1) {
        camZoom = 500 + Math.sin(time * 0.3) * 100;
        camRotY = time * 0.1;
    } else if (visualPhase === 2) {
        camZoom = 500 + Math.sin(time * 0.5) * 80;
        camRotX = 0.2;
        camRotY = time * 0.3;
    } else if (visualPhase === 3) {
        camZoom = 450 + Math.sin(time * 0.5) * 80;
        camRotY = time * 0.2;
    } else if (visualPhase === 4) {
        let lt = time - 13;
        camZoom = 400 - Math.min(lt * 5, 100); // Slow push in
        camRotX = 0.3;
        camRotY = time * 0.5; // Orbit
    } else if (visualPhase === 5) {
        let lt = time - 18;
        camZoom = 300 - Math.sin(lt * 0.5) * 50;
        camRotX = 0.1 + Math.sin(lt * 0.2) * 0.1;
        camRotY = time * 0.1;
    } else if (visualPhase === 6) { // Mobius
        let lt = time - 22;
        camZoom = 400 - lt * 2;
        camRotX = 0.4;
        camRotY = time * 0.2;
    } else if (visualPhase === 9) { // 3D Orderbook
        let lt = time - 31;
        camZoom = 600 - lt * 5; // Slow push in
        camRotX = 0.6 + Math.sin(lt * 0.3) * 0.1; // Looking down at the city
        camRotY = time * 0.15; // Orbit overhead
    } else if (visualPhase === 10) { // Hyper-Speed Tunnel
        let lt = time - 31;
        camZoom = 200 + Math.sin(lt * 2) * 30; // Tight inside the tunnel
        camRotX = Math.sin(lt * 0.5) * 0.15; // Barrel roll effect
        camRotY = lt * 0.8; // Fast spin
    } else if (visualPhase === 11) { // Ring (No Deposits)
        let lt = time - 40;
        camZoom = 450 + lt * 20; // Slow zoom out
        camRotX = 0.1;
        camRotY = time * 0.08;
    } else if (visualPhase === 12) { // Black Hole
        let lt = time - 40;
        camZoom = 550 - Math.pow(Math.max(0, lt), 2.5) * 1.5; // Extreme suck in
        camRotY = Math.pow(Math.max(0, lt), 2.0) * 0.3; // Accretion spin
        camRotX = Math.sin(lt * 20) * 0.02; // High frequency rumble
    } else if (visualPhase === 13) { // Gigachad Wall Break
        let lt = time - 47;
        camZoom = 700 - lt * 15; // Slow dolly in towards the wall
        camRotX = 0.15 - lt * 0.01; // Tilt down slowly
        camRotY = Math.sin(lt * 0.5) * 0.1; // Uneasy pan
    } else if (visualPhase === 14) { // Logo / Supernova
        let lt = time - 53;
        camZoom = 550 + Math.sin(lt * 0.2) * 20;
        camRotX = Math.sin(lt * 0.15) * 0.06;
        camRotY = Math.sin(lt * 0.05) * 0.3;
    } else {
        camZoom = 550;
        camRotY = time * 0.05;
    }

    let mobileZoomMultiplier = innerWidth < 800 ? (800 / innerWidth) : 1.0;
    camZoom *= mobileZoomMultiplier;

    // Apply visceral physical camera shake
    let shakeX = 0;
    let shakeY = 0;
    if (window.shakeIntensity > 0) {
        shakeX = (Math.random() - 0.5) * window.shakeIntensity * 0.005;
        shakeY = (Math.random() - 0.5) * window.shakeIntensity * 0.005;
    }

    particles.draw(time, visualPhase, state.transition, camRotX + shakeX, camRotY + shakeY, camZoom);
    drawHUD(state.phase);

    requestAnimationFrame(render);
}

async function startApp() {
    await fetchSolanaBlockhash();
    
    audio = new AudioEngine();
    audio.kick();
    audio.startDrone();
    
    // Create voice synth INSIDE the AudioContext so it gets captured in recordings
    voice = new VoiceSynth(audio.ctx, audio.masterOut);
    
    glEngine = new GLEngine('gl-canvas');
    textSampler = new TextSampler();
    await textSampler.preloadImages(); // Wait for images to load!

    particles = new ParticleSystem(glEngine, vsSource, fsSource, postVsSource, postFsSource);
    
    timeline = new Timeline(audio, voice);
    initHUD();

    document.getElementById('start-btn').addEventListener('click', () => {
        document.getElementById('start').style.display = 'none';
        
        if (audio && audio.ctx && audio.ctx.state === 'suspended') {
            audio.ctx.resume();
        }
        
        audio.startSequencer(); // Start the music!
        
        running = true;
        lastT = performance.now();
        time = 0;
        requestAnimationFrame(render);
    }, { once: true });
}

async function startRecording() {
    try {
        // Allow stopping the recording early
        if (window.globalRecorder && window.globalRecorder.state === 'recording') {
            console.log('Stopping recording early...');
            window.globalRecorder.stop();
            return;
        }
        
        console.log('=== SHX RECORDING ENGINE V21 ===');
        console.log('Initializing high-quality capture...');
        
        // Canvas video stream at 60fps
        const canvas = document.getElementById('gl-canvas');
        const videoStream = canvas.captureStream(60);
        const videoTrack = videoStream.getVideoTracks()[0];
        
        // Ensure AudioContext is running
        if (audio.ctx.state === 'suspended') await audio.ctx.resume();
        const audioTrack = audio.streamDestination.stream.getAudioTracks()[0];
        
        if (!audioTrack) {
            console.error('FATAL: No audio track from streamDestination!');
            return;
        }
        
        const combinedStream = new MediaStream([videoTrack, audioTrack]);
        
        // Try VP9 first (better quality), fallback to VP8
        let mimeType = 'video/webm; codecs=vp9,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm; codecs=vp8,opus';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'video/webm';
            }
        }
        console.log('Using codec:', mimeType);
        
        const recorder = new MediaRecorder(combinedStream, { 
            mimeType,
            videoBitsPerSecond: 12000000, // 12 Mbps for crisp quality
            audioBitsPerSecond: 256000    // 256 kbps audio
        });
        
        const chunks = [];
        
        // Collect data in 1-second timeslices to prevent memory issues
        recorder.ondataavailable = e => {
            if (e.data.size > 0) chunks.push(e.data);
        };
        
        recorder.onstop = () => {
            console.log(`Recording complete. ${chunks.length} chunks, downloading...`);
            const blob = new Blob(chunks, { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'SHX_Commercial_V21_Final.webm';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 500);
            videoTrack.stop();
            window.globalRecorder = null;
            console.log('=== RECORDING SAVED ===');
        };
        
        recorder.onerror = (e) => {
            console.error('MediaRecorder error:', e);
            window.globalRecorder = null;
        };
        
        // Reset the commercial and start recording
        console.log('Resetting timeline and starting in 300ms...');
        time = 0;
        timeline.reset();
        voice.reset();
        
        setTimeout(() => {
            recorder.start(1000); // 1-second timeslice chunks
            window.globalRecorder = recorder;
            console.log(`✓ Recording started at 12 Mbps ${mimeType}`);
            console.log('Will auto-stop at 62 visual seconds (~1:02)');
        }, 300);
        
    } catch (e) {
        console.error('Recording failed:', e);
        window.globalRecorder = null;
    }
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') {
        startRecording();
    }
});

startApp();
