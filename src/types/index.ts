
export interface PakFileEntry {
  name: string;
  path: string;
  offset: number;
  size: number;
  data: ArrayBuffer;
}

export interface FileTreeNode {
  type: 'file' | 'folder';
  name: string;
  path: string;
  children?: FileTree;
  file?: PakFileEntry;
}

export interface FileTree {
  [key: string]: FileTreeNode;
}

export type ArchiveType = 'pak' | 'pk3';

export type ClipboardItem = {
    type: 'copy' | 'cut';
    itemType: 'file' | 'folder';
    path: string;
} | null;

export interface SprFrame {
    group: number;
    originX: number;
    originY: number;
    width: number;
    height: number;
    imageDataUrl: string;
    size: number;
}

export interface SprData {
    version: number;
    type: string;
    texFormat: string;
    boundingRadius: number;
    maxWidth: number;
    maxHeight: number;
    numFrames: number;
    beamLength: number;
    syncType: string;
    palette: [number, number, number][];
    frames: SprFrame[];
}

    
