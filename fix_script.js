const fs = require('fs');

const content = fs.readFileSync('app/client.tsx', 'utf8');
const lines = content.split('\n');

// Find and fix the reduce function
let newLines = [];
let i = 0;

while (i < lines.length) {
  // Find the reduce function and add blank line before main return
  if (i === 1834 && lines[i].includes('}, []);')) {
    newLines.push(lines[i]); // Keep this line
    newLines.push(''); // Add blank line
    i++;

    // Add comment before return
    newLines.push('  // Render main app UI');
    i++;
  } else {
    newLines.push(lines[i]);
    i++;
  }
}

fs.writeFileSync('app/client.tsx', newLines.join('\n'));
console.log('Fixed - added blank line and comment');
