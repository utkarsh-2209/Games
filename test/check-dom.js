const fs = require('fs');
const html = fs.readFileSync('./public/index.html', 'utf-8');
const appJs = fs.readFileSync('./public/app.js', 'utf-8');

const idRegex = /getElementById\(['"]([^'"]+)['"]\)/g;
let match;
const ids = new Set();
while ((match = idRegex.exec(appJs)) !== null) {
  ids.add(match[1]);
}

const missing = [];
for (const id of ids) {
  if (!html.includes(`id="${id}"`) && !html.includes(`id='${id}'`)) {
    missing.push(id);
  }
}

console.log('Checked IDs:', ids.size);
console.log('Missing IDs:', missing);
