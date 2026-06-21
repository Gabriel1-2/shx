export class VoiceSynth {
    constructor() {
        this.queue = [];
    }

    say(text, timeTarget) {
        this.queue.push({ text, timeTarget, done: false });
    }

    update(currentTime) {
        if (!window.speechSynthesis) return;
        for (let v of this.queue) {
            if (!v.done && currentTime >= v.timeTarget) {
                v.done = true;
                const u = new SpeechSynthesisUtterance(v.text);
                u.rate = 0.95;
                u.pitch = 1.1; // Female pitch
                u.volume = 1;
                const vs = speechSynthesis.getVoices();
                const pk = vs.find(vo => vo.name.includes('Zira') || vo.name.includes('Female')) || 
                           vs.find(vo => vo.name.includes('Google') && vo.lang.startsWith('en')) || 
                           vs.find(vo => vo.lang.startsWith('en'));
                if (pk) u.voice = pk;
                speechSynthesis.speak(u);
            }
        }
    }
}
