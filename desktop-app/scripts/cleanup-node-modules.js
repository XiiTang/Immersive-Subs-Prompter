#!/usr/bin/env node

/**
 * 清理 node_modules 中的不必要文件，减少打包体积
 * 这个脚本在打包前运行，删除编译产物、文档、测试文件等
 */

const fs = require('fs');
const path = require('path');

const nodeModulesPath = path.join(__dirname, '..', 'node_modules');

// 要删除的目录和文件模式
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
  // 始终保留 package.json 和 node_modules/.package-lock.json
  if (fileName === 'package.json' || fileName === 'package-lock.json') {
    return false;
  }

  // 检查是否匹配移除模式
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
  if (depth > 10) return; // 限制递归深度

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
