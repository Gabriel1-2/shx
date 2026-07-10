const fs = require('fs');
let code = fs.readFileSync('js/shaders.js', 'utf8');
code = code.split('\\`').join('\`');
fs.writeFileSync('js/shaders.js', code);
