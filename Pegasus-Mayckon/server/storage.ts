// Local file storage implementation (100% independent, no external dependencies)
// Stores files in ./pegasus_storage/ relative to project root and serves via Express

import * as fs from 'fs';
import * as path from 'path';

// Base directory for all storage - relative to project root
const STORAGE_BASE_DIR = path.resolve(process.cwd(), 'pegasus_storage');

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_BASE_DIR)) {
  fs.mkdirSync(STORAGE_BASE_DIR, { recursive: true });
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, '');
}

function getFullPath(relKey: string): string {
  const normalized = normalizeKey(relKey);
  const fullPath = path.join(STORAGE_BASE_DIR, normalized);
  
  // Security: ensure path is within STORAGE_BASE_DIR
  if (!fullPath.startsWith(STORAGE_BASE_DIR)) {
    throw new Error('Invalid storage path');
  }
  
  return fullPath;
}

function getPublicUrl(relKey: string): string {
  const normalized = normalizeKey(relKey);
  return `/storage/${normalized}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = 'application/octet-stream'
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const fullPath = getFullPath(key);
  
  // Create directory if it doesn't exist
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Write file
  if (typeof data === 'string') {
    fs.writeFileSync(fullPath, data, 'utf8');
  } else {
    fs.writeFileSync(fullPath, Buffer.from(data));
  }
  
  const url = getPublicUrl(key);
  
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const fullPath = getFullPath(key);
  
  // Check if file exists
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${key}`);
  }
  
  const url = getPublicUrl(key);
  
  return { key, url };
}

// Export STORAGE_BASE_DIR for use in Express static middleware
export { STORAGE_BASE_DIR };
