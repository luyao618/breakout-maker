/**
 * run-all.js — Run all test suites and report summary
 */

const { execSync } = require('child_process');
const path = require('path');

const testFiles = [
  'test/physics/collision.test.js',
  'test/physics/physics-world.test.js',
  'test/image/mediancut.test.js',
  'test/image/brickmapper.test.js',
  'test/levels/levels.test.js',
  'test/entities/entities.test.js',
];

let totalPassed = 0;
let totalFailed = 0;
let totalTests = 0;
let failedSuites = [];

console.log('=== Running All Tests ===\n');

for (const file of testFiles) {
  try {
    const output = execSync(`node ${file}`, {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf-8',
      timeout: 30000,
    });
    console.log(output);

    // Parse results from output
    const match = output.match(/(\d+)\/(\d+) passed/);
    if (match) {
      const passed = parseInt(match[1]);
      const total = parseInt(match[2]);
      totalPassed += passed;
      totalTests += total;
      totalFailed += (total - passed);
      if (passed < total) {
        failedSuites.push(file);
      }
    }
  } catch (e) {
    console.error(`SUITE FAILED: ${file}`);
    console.error(e.stdout || e.stderr || e.message);
    failedSuites.push(file);
    // Try to extract partial results
    const output = e.stdout || '';
    const match = output.match(/(\d+)\/(\d+) passed/);
    if (match) {
      const passed = parseInt(match[1]);
      const total = parseInt(match[2]);
      totalPassed += passed;
      totalTests += total;
      totalFailed += (total - passed);
    }
  }
}

console.log('\n=== Summary ===');
console.log(`Total: ${totalPassed}/${totalTests} passed, ${totalFailed} failed`);
if (failedSuites.length > 0) {
  console.log(`Failed suites: ${failedSuites.join(', ')}`);
  process.exit(1);
} else {
  console.log('All suites passed!');
  process.exit(0);
}
