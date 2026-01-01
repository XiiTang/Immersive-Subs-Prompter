#!/usr/bin/env node

/**
 * Clean up unnecessary files in node_modules to reduce package size
 * This script runs before packaging to delete build artifacts, documentation, test files, etc.
 */

const fs = require('fs');
const path = require('path');

const nodeModulesPath = path.join(__dirname, '..', 'node_modules');

// Directories and file patterns to delete
const patternsToRemove = [
  '**/build',
  '**/*.map',
  '**/*.d.ts',
  '**/README*',
  '**/CHANGELOG*',
  '**/*.md',
  '**/.bin',
  '**/test',
  '**/tests',
  '**/spec',
  '**/docs',
  '**/*.tgz',
  '**/.git',
  '**/.github',
  '**/example*',
  '**/samples',
  '**/.eslintrc*',
  '**/.prettierrc*',
  '**/tsconfig.json',
  '**/tslint.json',
  '**/.npmignore',
  '**/.gitignore'
];

function removeFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }
      return true;
    }
  } catch (err) {
    console.error(`Failed to remove ${filePath}:`, err.message);
  }
  return false;
}

function shouldRemove(filePath, fileName) {
  // Always keep package.json and node_modules/.package-lock.json
  if (fileName === 'package.json' || fileName === 'package-lock.json') {
    return false;
  }

  // Check if it matches the removal pattern
  for (const pattern of patternsToRemove) {
    if (pattern.startsWith('**/')) {
      const suffix = pattern.slice(3);
      if (fileName === suffix || filePath.includes(path.sep + suffix)) {
        return true;
      }
    }
  }

  return false;
}

function cleanupDirectory(dir, depth = 0) {
  if (depth > 10) return; // Limit recursion depth

  try {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (shouldRemove(filePath, file)) {
        console.log(`Removing: ${path.relative(nodeModulesPath, filePath)}`);
        removeFile(filePath);
      } else if (stat.isDirectory() && !file.startsWith('.')) {
        cleanupDirectory(filePath, depth + 1);
      }
    });
  } catch (err) {
    console.error(`Error processing directory ${dir}:`, err.message);
  }
}

console.log('🧹 Cleaning up node_modules...');

if (fs.existsSync(nodeModulesPath)) {
  const startTime = Date.now();
  cleanupDirectory(nodeModulesPath);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`✅ Cleanup completed in ${duration}s`);
} else {
  console.warn('⚠️  node_modules directory not found');
}
