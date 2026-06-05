const fs = require('fs');
const js = fs.readFileSync('package/dist/index.js', 'utf-8');
const urls = js.match(/https:\/\/[^\s\"']+/g);
console.log(new Set(urls));
