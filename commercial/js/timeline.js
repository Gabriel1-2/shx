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
        this.voice.say("Legacy financial systems detected. Extreme latency. Hidden fees. Custodial risk.", 1);
        this.voice.say("Purging old protocols.", 7);
        this.voice.say("Introducing S H X. The next era of digital assets.", 10);
        this.voice.say("Global scale reach. Powered by the Jupiter V 6 aggregation engine.", 17);
        this.voice.say("Every decentralized exchange. Every liquidity pool. One route. Best price.", 26);
        this.voice.say("Swap over one thousand Solana tokens. Instantly.", 35);
        this.voice.say("On chain limit orders. Set your target price. Walk away. It executes when the market hits your number. Automatically.", 43);
        this.voice.say("Dollar cost averaging. Build positions systematically. Set the interval. Set the amount. S H X handles the rest.", 53);
        this.voice.say("One hundred percent non custodial. Your keys. Your coins. Trade directly from your Phantom or Solflare wallet.", 62);
        this.voice.say("The S H X ecosystem. Live analytics dashboard. Accessible to agents. No built in AI trading assistant.", 73);
        this.voice.say("No deposits. No withdrawals. Ever.", 80);
        this.voice.say("Push away the legacy system. No middlemen. No rent seekers.", 92);
        this.voice.say("S H X. Shulevitz Exchange. The next era of digital assets. Built for traders. Designed for the future.", 100);
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
    }

    setupPhases() {
        // Phase 0: 0-9 Chaos
        this.addText("> SCANNING GLOBAL FINANCIAL INFRASTRUCTURE...", 0.5, 1.8, 100, 300, 16, "#ff6464");
        this.addText("> LEGACY EXCHANGE DETECTED ............. COINBASE", 2, 1.5, 100, 330, 16, "#ff6464");
        this.addText("> HIDDEN FEES ........................... 1.49%", 3.5, 1.5, 100, 360, 16, "#ff6464");
        this.addText("> CUSTODIAL RISK ........................ EXTREME", 5, 1.5, 100, 390, 16, "#ff6464");
        this.addText("> WITHDRAWALS .......................... DELAYED", 6, 1.5, 100, 420, 16, "#ff6464");
        this.addText("> SOLUTION FOUND. PURGING...", 7.5, 0.8, 100, 450, 16, "#2FF36A");
        
        this.onEvent('ping1', 0.5, () => this.audio.ping());
        this.onEvent('ping2', 2, () => this.audio.ping());
        this.onEvent('ping3', 3.5, () => this.audio.ping());
        this.onEvent('ping4', 5, () => this.audio.ping());
        this.onEvent('riser', 7.5, () => { this.audio.kick(); this.audio.riser(1.5); });

        // Phase 1: 9-16 Helix
        this.addText("T H E   N E X T   E R A", 10, 2, 100, 200, 24, "#ffffff");
        this.addText("OF  DIGITAL  ASSETS", 11, 1.5, 100, 240, 24, "#ffffff");
        this.addText("BLOCKCHAIN ............ SOLANA", 13, 1.0, 100, 500);
        this.addText("FEES .................. 0 BPS", 14, 1.0, 100, 530);

        // Phase 2: 16-25 Globe
        this.addText("GLOBAL REACH", 17, 1.5, 100, 200, 24);
        this.addText("JUPITER V6 ENGINE", 19, 1.2, 100, 250);
        this.addText("LATENCY ............... <400ms", 21, 1.0, 100, 500);
        this.addText("SLIPPAGE PROTECTION ... ACTIVE", 23, 1.0, 100, 530);

        // Phase 3: 25-34 Torus
        this.addText("AGGREGATION ENGINE", 26, 1.5, 100, 200, 24);
        this.addText("DEX SOURCES ... RAYDIUM ORCA METEORA LIFINITY", 28, 1.2, 100, 250);
        this.addText("ROUTE OPTIMIZATION ............. BEST PATH", 30, 1.0, 100, 310);
        this.addText("EXECUTION SPEED ................ INSTANT", 32, 1.0, 100, 340);
        
        this.onEvent('beatStart', 25, () => this.audio.startSequencer());

        // Phase 4: 34-42 Coins
        this.addText("SWAP  ANY  TOKEN", 35, 1.5, 100, 200, 24);
        this.addText("> 1,000+ SOLANA TOKENS", 37, 1.0, 100, 250);
        this.addText("> DEEPEST LIQUIDITY", 39, 1.0, 100, 280);
        this.addText("> REAL-TIME PRICE FEEDS", 40, 1.0, 100, 310);

        // Phase 5: 42-52 Lock
        this.addText("ON-CHAIN LIMIT ORDERS", 43, 1.5, 100, 200, 24);
        this.addText("SET YOUR TARGET PRICE.", 45, 1.0, 100, 250);
        this.addText("WALK AWAY. IT EXECUTES.", 47, 1.0, 100, 280);
        this.addText("SECURE. AUTOMATIC.", 49, 1.0, 100, 310);

        // Phase 6: 52-61 Mobius
        this.addText("DOLLAR-COST AVERAGING", 53, 1.2, 100, 200, 24);
        this.addText("BUILD POSITIONS SYSTEMATICALLY.", 55, 1.0, 100, 250);
        this.addText("SET THE INTERVAL.", 57, 1.0, 100, 280);
        this.addText("SET THE AMOUNT.", 59, 1.0, 100, 310);

        // Phase 7: 61-72 Diamond
        this.addText("NON-CUSTODIAL. ALWAYS.", 62, 1.5, 100, 200, 24);
        this.addText("YOUR KEYS. YOUR COINS.", 64, 1.0, 100, 250);
        this.addText("TRADE FROM YOUR OWN WALLET.", 66, 1.0, 100, 280);

        // Phase 8: 72-78 Wave
        this.addText("THE SHX ECOSYSTEM", 73, 1.2, 100, 200, 24);
        this.addText("> LIVE ANALYTICS DASHBOARD", 74, 1.0, 100, 250);
        this.addText("> ACCESSIBLE TO AGENTS", 75, 1.0, 100, 280, 14, "#2FF36A");
        this.addText("> NO BUILT-IN AI TRADING ASSISTANT", 76, 1.0, 100, 310, 14, "#ff6464");

        // Phase 9: 78-85 Ring
        this.addText("NO DEPOSITS.", 79, 1.5, 100, 200, 24);
        this.addText("NO WITHDRAWALS.", 81, 1.0, 100, 250, 24);
        this.addText("EVER.", 83, 0.6, 100, 290, 24);
        
        this.onEvent('beatStop', 78, () => this.audio.stopSequencer());

        // Phase 10: 85-92 Warp
        this.addText("ENTERING  THE  NEXT  ERA...", 86, 2.5, innerWidth/2 - 200, innerHeight/2, 24);
        this.onEvent('riser2', 85, () => { this.audio.impact(); this.audio.riser(8.0); });

        // Phase 11: 92-100 People Pushing Wall
        this.addText("OVERTHROW THE LEGACY SYSTEM", 93, 1.5, 100, 200, 24, "#ff6464");
        this.addText("NO MIDDLEMEN.", 95, 1.0, 100, 250, 18, "#ff6464");
        this.addText("NO RENT SEEKERS.", 96, 1.0, 100, 280, 18, "#ff6464");
        this.addText("BREAK THE WALL.", 97, 1.0, 100, 310, 24, "#ffffff");
        this.addText("TAKE BACK CONTROL.", 98, 1.0, 100, 340, 24, "#2FF36A");
        
        this.onEvent('beatRestart', 92, () => this.audio.startSequencer());

        // Phase 12: 100+ Logo
        this.addText("S H U L E V I T Z   E X C H A N G E", 102.5, 2, innerWidth/2 - 180, innerHeight/2 + 100, 18);
        this.addText("The Next Era of Digital Assets", 105, 2, innerWidth/2 - 140, innerHeight/2 + 130, 16, "#2FF36A");
        this.addText("Built for traders. Designed for the future.", 107, 2, innerWidth/2 - 200, innerHeight/2 + 160, 16);
        this.addText(">>> shx.exchange <<<", 109, 2, innerWidth/2 - 100, innerHeight/2 + 200, 16);

        this.onEvent('mega', 100, () => { this.audio.megaImpact(); this.audio.chord(); });
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
        if (time >= 9 && time < 16) newPhase = 1;
        else if (time >= 16 && time < 25) newPhase = 2;
        else if (time >= 25 && time < 34) newPhase = 3;
        else if (time >= 34 && time < 42) newPhase = 4;
        else if (time >= 42 && time < 52) newPhase = 5;
        else if (time >= 52 && time < 61) newPhase = 6;
        else if (time >= 61 && time < 72) newPhase = 7;
        else if (time >= 72 && time < 78) newPhase = 8;
        else if (time >= 78 && time < 85) newPhase = 9;
        else if (time >= 85 && time < 92) newPhase = 10;
        else if (time >= 92 && time < 100) newPhase = 11;
        else if (time >= 100) newPhase = 12;

        if (newPhase !== this.phase) {
            this.phase = newPhase;
            this.transition = 0;
            if (this.phase !== 11 && this.phase !== 12 && this.phase !== 0) this.audio.impact();
            
            if (this.phase === 4) {
                // 3D Procedural Tokens Sequence
                particles.updateTargets(textSampler.solanaPoints); // Start with Solana
                
                // Keep references to clear these if user skips forward
                if (this.shxTimeout) clearTimeout(this.shxTimeout);
                if (this.trumpTimeout) clearTimeout(this.trumpTimeout);
                
                this.shxTimeout = setTimeout(() => {
                    if (this.phase === 4) particles.updateTargets(textSampler.shxPoints);
                }, 2800);
                
                this.trumpTimeout = setTimeout(() => {
                    if (this.phase === 4) particles.updateTargets(textSampler.trumpPoints);
                }, 5200);
            }
            if (this.phase === 12) {
                particles.updateTargets(textSampler.shxPoints);
            }
        }

        if (this.transition < 1.0) {
            this.transition += 0.015;
            if (this.transition > 1.0) this.transition = 1.0;
        }

        return { phase: this.phase, transition: this.transition };
    }
}
