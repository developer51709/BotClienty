const fs = require('fs');

const content = fs.readFileSync('app/client.tsx', 'utf8');
const lines = content.split('\n');

// Remove the entire if block (lines 1697-1814)
let newLines = [];
let i = 0;

while (i < lines.length) {
  if (i >= 1696 && i <= 1813) {
    // Skip the if block completely
    i++;
    continue;
  }
  newLines.push(lines[i]);
  i++;
}

fs.writeFileSync('app/client.tsx', newLines.join('\n'));
console.log('Removed if block (lines 1697-1814)');
