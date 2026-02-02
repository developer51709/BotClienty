const fs = require('fs');
const { exec } = require('child_process');

console.log('Executing fix script...');

// Fix 1: Add a blank line before the main return statement
exec('cd /home/engine/project && sed -i "1834a\\\\" app/client.tsx', (error, stdout, stderr) => {
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('Fix 1 applied');
});

// Fix 2: Check if build works
exec('cd /home/engine/project && npm run build 2>&1', (error, stdout, stderr) => {
  if (error) {
    console.error('Build error:', error);
    return;
  }

  // Check if build succeeded
  if (stdout.includes('Build successful') || !stdout.includes('Failed to compile')) {
    console.log('Build succeeded!');
    console.log('Build output:', stdout.substring(0, 500));
  } else {
    console.log('Build still failed');
    console.log(stdout.substring(0, 1000));
  }
});
