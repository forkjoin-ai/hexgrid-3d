#!/usr/bin/env bun
/**
 * Build script for WGSL shaders
 * Converts .wgsl files to .ts files with exported string constants
 * This enables IDE support and validation for WGSL while allowing TypeScript imports
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, basename, relative } from 'path';
import { execSync } from 'child_process';

const SRC_DIR = join(import.meta.dir, '..', 'src');
const GENERATED_HEADER = '// AUTO-GENERATED FILE - DO NOT EDIT\n// Generated from .wgsl source by scripts/build-shaders.ts\n\n';

function findWgslFiles(dir: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findWgslFiles(fullPath));
    } else if (entry.endsWith('.wgsl')) {
      files.push(fullPath);
    }
  }

  return files;
}

function validateWgsl(filePath: string): { valid: boolean; error?: string; skipped?: boolean } {
  // Try to validate with naga if available
  try {
    execSync(`which naga`, { stdio: 'pipe' });
  } catch {
    // naga not installed - skip validation
    return { valid: true, skipped: true };
  }

  try {
    // naga validates by default when no output file is specified
    execSync(`naga "${filePath}"`, { stdio: 'pipe' });
    return { valid: true };
  } catch (e: unknown) {
    const error = e as { stderr?: Buffer; stdout?: Buffer };
    const errorMsg = error.stderr?.toString() || error.stdout?.toString() || 'Unknown validation error';
    return { valid: false, error: errorMsg };
  }
}

function generateTs(wgslPath: string): string {
  const content = readFileSync(wgslPath, 'utf-8');
  const name = basename(wgslPath, '.wgsl')
    .replace(/[-_]([a-z])/g, (_, c) => c.toUpperCase()) // kebab/snake to camelCase
    .replace(/^./, c => c.toLowerCase());

  const constName = name + 'Shader';

  return `${GENERATED_HEADER}export const ${constName} = \`${content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;\n\nexport default ${constName};\n`;
}

function main() {
  const wgslFiles = findWgslFiles(SRC_DIR);

  if (wgslFiles.length === 0) {
    console.log('No .wgsl files found');
    return;
  }

  let hasErrors = false;

  let validationSkipped = false;

  for (const wgslPath of wgslFiles) {
    const relativePath = relative(SRC_DIR, wgslPath);

    // Validate
    const validation = validateWgsl(wgslPath);
    if (validation.skipped) {
      validationSkipped = true;
    }
    if (!validation.valid) {
      console.error(`❌ ${relativePath}: WGSL validation failed`);
      console.error(validation.error);
      hasErrors = true;
      continue;
    }

    // Generate .ts file
    const tsPath = wgslPath.replace(/\.wgsl$/, '.generated.ts');
    const tsContent = generateTs(wgslPath);

    writeFileSync(tsPath, tsContent);
    console.log(`✓ ${relativePath} -> ${basename(tsPath)}`);
  }

  if (validationSkipped) {
    console.log('\nNote: Install naga-cli for WGSL validation: cargo install naga-cli');
  }

  if (hasErrors) {
    process.exit(1);
  }
}

main();
