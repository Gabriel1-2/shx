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
    hudCtx = hudCanvas.getContext('2d');
    const resizeHud = () => {
        hudCanvas.width = innerWidth * devicePixelRatio;
        hudCanvas.height = innerHeight * devicePixelRatio;
        hudCanvas.style.width = innerWidth + 'px';
        hudCanvas.style.height = innerHeight + 'px';
        hudCtx.scale(devicePixelRatio, devicePixelRatio);
        hudCtx.font = "bold 14px 'Courier New', Courier, monospace";
        hudCtx.textBaseline = "top";

        // Center aligned logic instead of fixed offsets
        for (let t of timeline.texts) {
            if (t.text.includes("ENTERING")) {
                t.x = innerWidth/2;
                t.y = innerHeight/2;
                t.align = "center";
            } else if (t.text.includes("S H U L E V I T Z")) {
                t.x = innerWidth/2;
                t.y = innerHeight/2 + 80;
                t.align = "center";
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
                t.y = innerHeight/2 + 180;
                t.align = "center";
            } else {
                // If it's on the left, add some padding
                t.x = 20 + (innerWidth > 800 ? 80 : 0);
            }
        }
    };
    resizeHud();
    window.addEventListener('resize', resizeHud);
}

function drawHUD(phase) {
    hudCtx.clearRect(0, 0, innerWidth, innerHeight);
    
    hudCtx.fillStyle = 'rgba(47,243,106,0.3)';
    hudCtx.fillText("SHX_TERMINAL v5.0.0", innerWidth - 180, 20);
    hudCtx.fillText(`BLK ${(2847300 + Math.floor(time * 12))}`, innerWidth - 180, 40);
    
    let s = Math.floor(time);
    let m = Math.floor(s / 60);
    s %= 60;
    hudCtx.fillText(`T+${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`, innerWidth - 180, 60);

    hudCtx.fillText("[ SHX ]", 20, 20);
    hudCtx.fillText("SOLANA MAINNET", 20, 40);

    for (let t of timeline.texts) {
        let textPhase = 0;
        if (t.timeTarget >= 9 && t.timeTarget < 16) textPhase = 1;
        else if (t.timeTarget >= 16 && t.timeTarget < 25) textPhase = 2;
        else if (t.timeTarget >= 25 && t.timeTarget < 34) textPhase = 3;
        else if (t.timeTarget >= 34 && t.timeTarget < 42) textPhase = 4;
        else if (t.timeTarget >= 42 && t.timeTarget < 52) textPhase = 5;
        else if (t.timeTarget >= 52 && t.timeTarget < 61) textPhase = 6;
        else if (t.timeTarget >= 61 && t.timeTarget < 72) textPhase = 7;
        else if (t.timeTarget >= 72 && t.timeTarget < 78) textPhase = 8;
        else if (t.timeTarget >= 78 && t.timeTarget < 85) textPhase = 9;
        else if (t.timeTarget >= 85 && t.timeTarget < 92) textPhase = 10;
        else if (t.timeTarget >= 92 && t.timeTarget < 100) textPhase = 11;
        else if (t.timeTarget >= 100) textPhase = 12;

        if (textPhase !== phase && textPhase !== 12) continue; // Phase 12 stays forever

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
            hudCtx.fillStyle = t.color || '#1CA478';
            if (t.color === '#ffffff') hudCtx.fillStyle = '#ffffff';
            hudCtx.font = `bold ${(t.size || 14) * scaleFactor}px 'Courier New', Courier, monospace`;
            if (t.align === "center") {
                hudCtx.textAlign = "center";
            } else {
                hudCtx.textAlign = "left";
            }
            hudCtx.fillText(str, t.x, t.y);
            
            if (res > 0 && res < t.text.length && Math.floor(time * 50) % 3 === 0) {
                audio.osc(200+Math.random()*600, 'square', 0.02, 0.008);
            }
        }
    }
}

function render(ts) {
    if (!running) return;
    let dt = (ts - lastT) / 1000;
    lastT = ts;
    time += dt;

    if (window.shakeIntensity > 0.5) window.shakeIntensity *= 0.86;
    else window.shakeIntensity = 0;

    const state = timeline.update(time, particles, textSampler);
    
    camRotX = 0;
    camRotY = 0;
    
    if (state.phase === 1) {
        camZoom = 500 + Math.sin(time * 0.3) * 100;
        camRotY = time * 0.1;
    } else if (state.phase === 2) {
        camZoom = 500 + Math.sin(time * 0.5) * 80;
        camRotX = 0.2;
        camRotY = time * 0.3;
    } else if (state.phase === 3) {
        camZoom = 450 + Math.sin(time * 0.5) * 80;
        camRotY = time * 0.2;
    } else if (state.phase === 4) {
        camZoom = 350 + Math.sin(time * 1.0) * 50;
        camRotX = 0.3;
        // In phase 4, rotate around the tokens!
        camRotY = time * 0.5;
    } else if (state.phase === 5) {
        camZoom = 300;
        camRotX = 0.1;
        camRotY = time * 0.1;
    } else if (state.phase === 10) { // Warp
        camZoom = 550;
        camRotY = 0;
    } else if (state.phase === 11) { // Wall Break
        let lt = time - 92;
        camZoom = 600 - lt * 10; // Zoom in aggressively as wall breaks
        camRotX = 0.1;
        camRotY = 0;
    } else if (state.phase === 12) { // Logo
        let lt = time - 100;
        camZoom = 550 + Math.sin(lt * 0.2) * 20;
        camRotX = Math.sin(lt * 0.15) * 0.06;
        camRotY = Math.sin(lt * 0.05) * 0.3;
    } else {
        camZoom = 550;
        camRotY = time * 0.05;
    }

    let mobileZoomMultiplier = innerWidth < 800 ? (800 / innerWidth) : 1.0;
    camZoom *= mobileZoomMultiplier;

    particles.draw(time, state.phase, state.transition, camRotX, camRotY, camZoom);
    drawHUD(state.phase);

    requestAnimationFrame(render);
}

async function startApp() {
    await fetchSolanaBlockhash();
    
    audio = new AudioEngine();
    audio.kick();
    audio.startDrone();
    
    voice = new VoiceSynth();
    
    glEngine = new GLEngine('gl-canvas');
    textSampler = new TextSampler();
    await textSampler.preloadImages(); // Wait for images to load!

    particles = new ParticleSystem(glEngine, vsSource, fsSource, postVsSource, postFsSource);
    
    timeline = new Timeline(audio, voice);
    initHUD();

    running = true;
    lastT = performance.now();
    time = 0;
    requestAnimationFrame(render);
    
    // Browser audio policy workaround: Resume on first click anywhere
    document.addEventListener('click', () => {
        if (audio && audio.ctx && audio.ctx.state === 'suspended') {
            audio.ctx.resume();
        }
    }, { once: true });
}

async function startRecording() {
    try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: 60, displaySurface: "browser" },
            audio: false
        });
        
        const videoTrack = displayStream.getVideoTracks()[0];
        const audioTrack = audio.streamDestination.stream.getAudioTracks()[0];
        
        const combinedStream = new MediaStream([videoTrack, audioTrack]);
        const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm; codecs=vp9' });
        const chunks = [];
        
        recorder.ondataavailable = e => {
            if (e.data.size > 0) chunks.push(e.data);
        };
        
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'shx_commercial.webm';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
            videoTrack.stop();
        };
        
        // Reset the ad and start recording
        time = 0;
        timeline.reset();
        recorder.start();
        
        setTimeout(() => {
            if (recorder.state === "recording") recorder.stop();
        }, 115000); // 115 seconds covers the whole ad
        
    } catch (e) {
        console.error("Recording failed", e);
    }
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') {
        startRecording();
    }
});

startApp();
