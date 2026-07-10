const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegStatic);

const VIDEO_INPUT = './shx-ad-raw.mp4';
const TIMELINE_INPUT = './timeline.json';
const AUDIO_DIR = './assets/audio';
const OUTPUT_FILE = './shx-ad-120fps-foley.mp4';

// Check if raw video exists
if (!fs.existsSync(VIDEO_INPUT)) {
    console.error(`❌ Cannot find ${VIDEO_INPUT}. Run 'npm run record-ad' first.`);
    process.exit(1);
}

// Check if timeline exists
if (!fs.existsSync(TIMELINE_INPUT)) {
    console.error(`❌ Cannot find ${TIMELINE_INPUT}. Run 'npm run record-ad' first.`);
    process.exit(1);
}

// Check if audio assets exist
const bgMusic = path.join(AUDIO_DIR, 'background-music.mp3');
const clickSound = path.join(AUDIO_DIR, 'ui-click.wav');

if (!fs.existsSync(bgMusic) || !fs.existsSync(clickSound)) {
    console.error(`❌ Missing audio assets! Please add the following files:`);
    console.error(`   - ${bgMusic}`);
    console.error(`   - ${clickSound}`);
    process.exit(1);
}

console.log("🎛️ Loading programmatic Foley timeline...");
const timeline = JSON.parse(fs.readFileSync(TIMELINE_INPUT, 'utf8'));

let command = ffmpeg()
    .input(VIDEO_INPUT)     // 0:v
    .input(bgMusic)         // 1:a
    .input(clickSound);     // 2:a

// We might want a swoosh sound later, but for now we map swoosh to click or just use click for all
// We only have clickSound.

// Build the filter complex
// [1:a] volume=0.5 [bg]; 
// [2:a] adelay=1000|1000 [fx1];
// [2:a] adelay=2500|2500 [fx2];
// [bg][fx1][fx2] amix=inputs=3 [aout]

let filterComplex = '[1:a]volume=0.8[bg];';
let amixInputs = '[bg]';
let numMixes = 1;

timeline.forEach((event, index) => {
    // Only process clicks and swooshes (we map all to click sound for now)
    if (event.type === 'click' || event.type === 'swoosh' || event.type === 'transition') {
        const delayMs = event.timeMs;
        const fxLabel = `[fx${index}]`;
        // Audio stream 2 is the click sound
        filterComplex += `[2:a]adelay=${delayMs}|${delayMs},volume=1.0${fxLabel};`;
        amixInputs += fxLabel;
        numMixes++;
    }
});

filterComplex += `${amixInputs}amix=inputs=${numMixes}:duration=first:dropout_transition=0[aout]`;

console.log(`🎚️ Mixing ${numMixes - 1} UI Foley events over background music...`);

command
    .complexFilter(filterComplex, ['aout'])
    .outputOptions([
        '-map 0:v',      // take video from input 0
        '-c:v copy',     // copy video without re-encoding!
        '-c:a aac',      // encode mixed audio to AAC
        '-b:a 192k',     // high quality audio
        '-shortest'      // stop encoding when the shortest stream ends (the video)
    ])
    .save(OUTPUT_FILE)
    .on('start', (cmdLine) => {
        console.log('🎬 Executing FFmpeg Engine...');
    })
    .on('error', (err) => {
        console.error('❌ Error during sound engineering:', err.message);
    })
    .on('end', () => {
        console.log(`✅ Sound Engineering Complete!`);
        console.log(`🔥 Final masterpiece saved to: ${OUTPUT_FILE}`);
    });
