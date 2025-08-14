
import type { PakFileEntry, FileTree, FileTreeNode } from '@/types';
import JSZip from 'jszip';

const PAK_HEADER_ID = 'PACK';
const PAK_HEADER_SIZE = 12; // 4 (id) + 4 (dirOffset) + 4 (dirLength)
const PAK_DIR_ENTRY_SIZE = 64; // 56 (name) + 4 (offset) + 4 (size)

/**
 * Parses a PAK file from an ArrayBuffer.
 * @param buffer The ArrayBuffer containing the PAK file data.
 * @returns A promise that resolves to an array of PakFileEntry objects.
 */
export async function parsePak(buffer: ArrayBuffer): Promise<PakFileEntry[]> {
  const view = new DataView(buffer);
  const textDecoder = new TextDecoder('utf-8');

  // 1. Read header
  const headerId = textDecoder.decode(buffer.slice(0, 4));
  if (headerId !== PAK_HEADER_ID) {
    throw new Error('Invalid PAK file format.');
  }

  const dirOffset = view.getUint32(4, true);
  const dirLength = view.getUint32(8, true);

  if (dirOffset + dirLength > buffer.byteLength) {
    throw new Error('PAK directory is out of bounds.');
  }

  // 2. Read directory entries
  const numEntries = dirLength / PAK_DIR_ENTRY_SIZE;
  const entries: PakFileEntry[] = [];

  for (let i = 0; i < numEntries; i++) {
    const entryOffset = dirOffset + i * PAK_DIR_ENTRY_SIZE;

    // Read filename (null-terminated C-string)
    const nameBuffer = buffer.slice(entryOffset, entryOffset + 56);
    const nameEnd = new Uint8Array(nameBuffer).indexOf(0);
    const name = textDecoder.decode(nameBuffer.slice(0, nameEnd)).replace(/\\/g, '/');

    const fileOffset = view.getUint32(entryOffset + 56, true);
    const fileSize = view.getUint32(entryOffset + 60, true);
    
    if (fileOffset + fileSize > buffer.byteLength) {
        console.warn(`File "${name}" is out of bounds. Skipping.`);
        continue;
    }

    const fileData = buffer.slice(fileOffset, fileOffset + fileSize);

    entries.push({
      name: name.split('/').pop() || '',
      path: name,
      offset: fileOffset,
      size: fileSize,
      data: fileData,
    });
  }

  return entries;
}

/**
 * Creates a PAK file ArrayBuffer from a list of file entries.
 * @param entries An array of PakFileEntry objects.
 * @returns A promise that resolves to an ArrayBuffer of the new PAK file.
 */
export async function createPak(entries: PakFileEntry[]): Promise<ArrayBuffer> {
  const textEncoder = new TextEncoder();
  const relevantEntries = entries.filter(e => e.name !== '.placeholder' || e.size > 0);

  // 1. Create updated entries with correct offsets and collect data chunks
  let currentFileOffset = PAK_HEADER_SIZE;
  const fileDataChunks: {data: Uint8Array, offset: number}[] = [];
  
  const updatedEntries = relevantEntries.map(entry => {
    const data = new Uint8Array(entry.data);
    const newEntry = { ...entry, offset: currentFileOffset, size: data.byteLength };
    fileDataChunks.push({ data, offset: currentFileOffset });
    currentFileOffset += data.byteLength;
    return newEntry;
  });
  
  // 2. Calculate final offsets and total size
  const dirOffset = currentFileOffset;
  const dirSize = updatedEntries.length * PAK_DIR_ENTRY_SIZE;
  const totalSize = dirOffset + dirSize;

  // 3. Allocate buffer
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const uint8View = new Uint8Array(buffer);

  // 4. Write header
  uint8View.set(textEncoder.encode(PAK_HEADER_ID), 0);
  view.setUint32(4, dirOffset, true);
  view.setUint32(8, dirSize, true);
  
  // 5. Write all file data chunks
  fileDataChunks.forEach(chunk => {
    uint8View.set(chunk.data, chunk.offset);
  });
  
  // 6. Write directory using the updated entries with correct offsets
  let currentDirWriteOffset = dirOffset;
  updatedEntries.forEach(entry => {
    // Write filename (as null-terminated string)
    const nameBytes = textEncoder.encode(entry.path);
    const nameBuffer = new Uint8Array(56).fill(0);
    // Truncate name if it's too long for the 56-byte buffer
    nameBuffer.set(nameBytes.slice(0, 56));
    uint8View.set(nameBuffer, currentDirWriteOffset);
    currentDirWriteOffset += 56;

    // Write offset and size
    view.setUint32(currentDirWriteOffset, entry.offset, true);
    currentDirWriteOffset += 4;
    view.setUint32(currentDirWriteOffset, entry.size, true);
    currentDirWriteOffset += 4;
  });

  return buffer;
}


/**
 * Parses a ZIP-based archive (.pk3, .zip) from an ArrayBuffer.
 * @param buffer The ArrayBuffer containing the ZIP file data.
 * @returns A promise that resolves to an array of PakFileEntry objects.
 */
export async function parseZip(buffer: ArrayBuffer): Promise<PakFileEntry[]> {
    const zip = await JSZip.loadAsync(buffer);
    const entries: PakFileEntry[] = [];
    const filePaths = new Set<string>();

    const files = Object.values(zip.files);

    // First pass: process all files
    for (const zipEntry of files) {
        if (zipEntry.dir) continue; 
        
        filePaths.add(zipEntry.name);
        const data = await zipEntry.async('arraybuffer');
        entries.push({
            name: zipEntry.name.split('/').pop() || '',
            path: zipEntry.name,
            offset: 0, // Not applicable for ZIP creation
            size: data.byteLength,
            data,
        });
    }

    // Second pass: find empty directories by checking for dir entries
    // that don't have corresponding file entries.
    for (const zipEntry of files) {
        if (zipEntry.dir) {
            const dirPath = zipEntry.name;
            // Check if any file path starts with this directory path
            const hasFiles = Array.from(filePaths).some(fp => fp.startsWith(dirPath));
            if (!hasFiles) {
                // This is an empty directory, add a placeholder
                const placeholderPath = `${dirPath}.placeholder`;
                entries.push({
                    name: '.placeholder',
                    path: placeholderPath,
                    offset: 0,
                    size: 0,
                    data: new ArrayBuffer(0),
                });
            }
        }
    }

    return entries;
}

/**
 * Creates a ZIP-based archive ArrayBuffer from a list of file entries.
 * @param entries An array of PakFileEntry objects.
 * @param compressionLevel The compression level from 0 (no compression) to 9 (max).
 * @returns A promise that resolves to an ArrayBuffer of the new ZIP file.
 */
export async function createZip(entries: PakFileEntry[], compressionLevel: number = 6): Promise<ArrayBuffer> {
  const zip = new JSZip();

  const relevantEntries = entries.filter(e => e.name !== '.placeholder' || e.size > 0);

  for (const entry of relevantEntries) {
    zip.file(entry.path, entry.data, {
      compression: compressionLevel > 0 ? 'DEFLATE' : 'STORE',
      compressionOptions: compressionLevel > 0 ? {
        level: compressionLevel,
      } : undefined,
    });
  }

  return zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: {
        level: compressionLevel,
    }
  });
}


/**
 * Builds a hierarchical file tree from a flat list of PAK file entries.
 * @param entries An array of PakFileEntry objects.
 * @returns A FileTree object representing the directory structure.
 */
export function buildFileTree(entries: PakFileEntry[]): FileTree {
  const tree: FileTree = {};

  if (!entries || typeof entries[Symbol.iterator] !== 'function') {
    console.error('buildFileTree received non-iterable entries:', entries);
    return tree; // Return an empty tree if entries is not iterable
  }

  const sortedEntries = [...entries].sort((a, b) => a.path.localeCompare(b.path));

  for (const entry of sortedEntries) {
    const parts = entry.path.split('/');
    let currentLevel = tree;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue; 
      
      const isLastPart = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      if (!currentLevel[part]) {
         if (isLastPart) {
            // It's a file
            if (entry.name === '.placeholder' && entry.size === 0) {
              // This case should be handled by the parent folder creation logic,
              // but as a fallback, we can ignore it to prevent file nodes for placeholders.
              continue;
            }
            currentLevel[part] = {
                type: 'file',
                name: part,
                path: currentPath,
                file: entry,
            };
         } else {
             // It's a folder
            currentLevel[part] = {
                type: 'folder',
                name: part,
                path: currentPath,
                children: {},
            };
         }
      }
      
      const node = currentLevel[part];
      if (node.type === 'folder' && node.children) {
          currentLevel = node.children;
      } else if (!isLastPart) {
          // This is a path conflict, e.g. trying to create `a/b` when `a` is a file.
           console.warn(`Cannot create directory structure. A file exists at path: ${node.path}`);
           break;
      }
    }
  }

  return tree;
}

/**
 * Calculates the SHA-256 hash of an ArrayBuffer.
 * @param buffer The ArrayBuffer to hash.
 * @returns A promise that resolves to a hex string representation of the hash.
 */
export async function calculateHash(buffer: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

    