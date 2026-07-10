export class Timeline {
    constructor(audio, voice) {
        this.audio = audio;
        this.voice = voice;
        this.phase = 0;
        this.transition = 0;
        this.texts = [];
        this.events = {};
        
        this.setupVoice();
        this.setupPhases();
    }

    setupVoice() {
        // Phase 0: Intro (0-5s)
        this.voice.say("Legacy financial systems detected.", 1.0);
        this.voice.say("Introducing S H X.", 3.5);
        
        // Phase 1: Speed Drop (5-13s)
        this.voice.say("Powered by the Jupiter V 6 aggregation engine.", 6.0);
        this.voice.say("Sub four hundred millisecond execution.", 9.0);
        this.voice.say("Best price.", 11.0);
        
        // Phase 2: Features (13-22s)
        this.voice.say("Swap over one thousand Solana tokens. Instantly.", 14.0);
        this.voice.say("On chain limit orders.", 18.0);
        this.voice.say("Set your target price.", 20.0);
        this.voice.say("Walk away.", 21.0);
        
        // Phase 3: DCA & Security (22-31s)
        this.voice.say("Dollar cost averaging. Build positions systematically.", 23.0);
        this.voice.say("One hundred percent non custodial.", 27.0);
        this.voice.say("Your keys. Your coins.", 29.0);
        
        // Phase 4: The Matrix & Tunnel (31-40s)
        this.voice.say("Entering the liquidity matrix.", 32.0);
        this.voice.say("One hundred fifty million daily volume.", 34.0);
        this.voice.say("Execution at lightspeed.", 37.0);
        
        // Phase 5: The Stop (40-47s)
        this.voice.say("No deposits.", 41.0);
        this.voice.say("No withdrawals.", 43.0);
        this.voice.say("Ever.", 45.0);
        
        // Phase 6: Final Build Up (47-53s)
        this.voice.say("Overthrow the legacy system.", 48.0);
        this.voice.say("Take back control.", 50.0);
        
        // Phase 7: Supernova Finale (53-60s)
        this.voice.say("S H X. Shulevitz Exchange.", 55.0);
        this.voice.say("Built for traders. Designed for the future.", 57.0);
        this.voice.say("Enter the matrix.", 58.5);
    }

    setupPhases() {
        const innerWidth = window.innerWidth;
        const innerHeight = window.innerHeight;

        // Phase 0: 0-5s Intro
        this.addText("SYSTEM BOOT...", 1.0, 1.0, 100, 200, 24, "#ff6464");
        this.addText("LATENCY: EXTREME", 2.0, 1.0, 100, 250, 24, "#ff6464");
        this.addText("FEES: HIDDEN", 2.5, 1.0, 100, 290, 24, "#ff6464");
        
        this.onEvent('glitch', 2.0, () => {
            this.audio.noise(0.5, 0.5, true, true);
            document.getElementById('gl-canvas').style.filter = "contrast(200%) hue-rotate(90deg)";
            setTimeout(() => { document.getElementById('gl-canvas').style.filter = "none"; }, 100);
        });

        // Phase 1: 5-13s Speed Drop
        this.addText("S H X", 5.0, 2.0, innerWidth/2 - 100, innerHeight/2, 64, "#ffffff");
        this.addText("> JUPITER V6 AGGREGATION", 7.0, 1.5, 100, 200, 24, "#2FF36A");
        this.addText("> SUB-400MS LATENCY", 9.5, 1.5, 100, 250, 24);
        this.addText("> BEST PRICE ROUTING", 11.5, 1.5, 100, 290, 24, "#2FF36A");

        // Phase 2: 13-22s Features (Tokens & Limits)
        this.addText("1,000+ SOLANA TOKENS", 14.0, 1.5, 100, 200, 38);
        this.addText("BONK  >  JUP  >  RAY  >  ORCA", 15.5, 1.0, 100, 250, 24, "#2FF36A");
        
        this.addText("ON-CHAIN LIMIT ORDERS", 18.0, 1.5, 100, 320, 38, "#ffffff");
        this.addText("SET YOUR TARGET PRICE.", 20.0, 1.0, 100, 370, 24);
        this.addText("WALK AWAY.", 21.0, 1.0, 100, 410, 28, "#2FF36A");

        // Phase 3: 22-31s DCA & Security
        this.addText("DOLLAR-COST AVERAGING", 23.0, 1.2, 100, 200, 38);
        this.addText("BUILD POSITIONS SYSTEMATICALLY.", 24.5, 1.0, 100, 250, 24);
        
        this.addText("100% NON-CUSTODIAL", 27.0, 1.5, 100, 320, 38, "#2FF36A");
        this.addText("YOUR KEYS. YOUR COINS.", 29.0, 1.0, 100, 370, 28, "#ffffff");

        // Phase 4: 31-40s The Matrix & Tunnel
        this.addText("THE LIQUIDITY MATRIX", 32.0, 1.5, 100, 200, 38, "#ffffff");
        this.addText("150M+ DAILY VOLUME", 34.0, 1.0, 100, 250, 28, "#2FF36A");
        
        this.addText("EXECUTION AT LIGHTSPEED", 37.0, 1.5, 100, 320, 38, "#ffffff");
        this.onEvent('v_tunnel', 36.0, () => {
            this.audio.laserSweep();
        });

        // Phase 5: 40-47s The Stop
        this.addText("NO DEPOSITS.", 41.0, 1.5, 100, 200, 48, "#ff6464");
        this.addText("NO WITHDRAWALS.", 43.0, 1.0, 100, 260, 48, "#ff6464");
        this.addText("EVER.", 45.0, 0.6, 100, 320, 48, "#ffffff");
        
        this.onEvent('beatStop', 40.0, () => {
            // The sequencer now handles the breakdown internally via Phase 5
        });

        // Phase 6: 47-53s Final Build Up
        this.addText("OVERTHROW THE LEGACY SYSTEM", 48.0, 1.5, 100, 200, 38, "#ff6464");
        this.addText("TAKE BACK CONTROL.", 50.0, 1.0, 100, 260, 38, "#2FF36A");
        
        this.onEvent('blackhole', 47.0, () => { 
            this.audio.impact(); 
            this.audio.blackHoleSuck(); 
        });
        
        this.onEvent('beatRestart', 47.5, () => {
            this.audio.riser(5.5); // Shortened riser for 60s
        });

        // Phase 7: 53-60s Supernova Finale
        this.addText("S H X   E X C H A N G E", 55.0, 1.5, innerWidth/2 - 240, innerHeight/2 + 80, 36);
        this.addText("Built for traders. Designed for the future.", 57.0, 1.5, innerWidth/2 - 320, innerHeight/2 + 140, 24, "#2FF36A");
        this.addText("ENTER THE MATRIX", 58.0, 1.5, innerWidth/2 - 140, innerHeight/2 + 200, 28, "#ff6464");
        this.addText("app.shx.exchange", 59.0, 1.5, innerWidth/2 - 140, innerHeight/2 + 250, 28, "#ffffff");

        this.onEvent('mega', 53.0, () => { 
            this.audio.supernovaImpact(); 
            this.audio.chord(); 
        });
    }

    addText(text, timeTarget, duration, x, y, size=14, color="#ffffff") {
        this.texts.push({ text, timeTarget, duration, x, y, size, color });
    }

    onEvent(id, timeTarget, fn) {
        this.events[id] = { timeTarget, fn, done: false };
    }

    reset() {
        this.phase = 0;
        this.transition = 0;
        for (let k in this.events) {
            this.events[k].done = false;
        }
        this.voice.reset();
        
        if (this.shxTimeout) clearTimeout(this.shxTimeout);
        if (this.bonkTimeout) clearTimeout(this.bonkTimeout);
    }

    update(time, particles, textSampler) {
        this.voice.update(time);
        
        for (let k in this.events) {
            let ev = this.events[k];
            if (!ev.done && time >= ev.timeTarget) {
                ev.done = true;
                ev.fn();
            }
        }

        let newPhase = 0;
        if (time >= 5 && time < 13) newPhase = 1;
        else if (time >= 13 && time < 22) newPhase = 2;
        else if (time >= 22 && time < 31) newPhase = 3;
        else if (time >= 31 && time < 40) newPhase = 4;
        else if (time >= 40 && time < 47) newPhase = 5;
        else if (time >= 47 && time < 53) newPhase = 6;
        else if (time >= 53) newPhase = 7;

        if (newPhase !== this.phase) {
            this.phase = newPhase;
            this.audio.currentPhase = newPhase; // CRITICAL FIX: Tell the music sequencer to change beats!
            this.transition = 0;
            if (this.phase !== 6 && this.phase !== 7 && this.phase !== 0) this.audio.impact();
            
            if (this.phase === 2) {
                // 3D Procedural Tokens Sequence
                particles.updateTargets(textSampler.solanaPoints); // Start with Solana
                
                // Keep references to clear these if user skips forward
                if (this.shxTimeout) clearTimeout(this.shxTimeout);
                if (this.bonkTimeout) clearTimeout(this.bonkTimeout);
                
                this.shxTimeout = setTimeout(() => {
                    if (this.phase === 2) particles.updateTargets(textSampler.shxPoints);
                }, 2500);
                
                this.bonkTimeout = setTimeout(() => {
                    if (this.phase === 2) particles.updateTargets(textSampler.bonkPoints);
                }, 5000);
            }
            if (this.phase === 7) {
                particles.updateTargets(textSampler.shxPoints);
            }
        }

        if (this.transition < 1.0) {
            this.transition += 0.02; // Faster transition for 60s cut
            if (this.transition > 1.0) this.transition = 1.0;
        }

        return { phase: this.phase, transition: this.transition };
    }
}
