
import type { SprData, SprFrame } from '@/types';

const SPR_ID = 'IDSP';
const PALETTE_SIZE = 256;

export function parseSpr(buffer: ArrayBuffer): SprData {
  const view = new DataView(buffer);
  const textDecoder = new TextDecoder('utf-8');

  // Header
  const id = textDecoder.decode(buffer.slice(0, 4));
  if (id !== SPR_ID) {
    throw new Error('Invalid SPR file identifier.');
  }

  const version = view.getInt32(4, true);
  const type = view.getInt32(8, true);
  const texFormat = view.getInt32(12, true);
  const boundingRadius = view.getFloat32(16, true);
  const maxWidth = view.getInt32(20, true);
  const maxHeight = view.getInt32(24, true);
  const numFrames = view.getInt32(28, true);
  const beamLength = view.getFloat32(32, true);
  const syncType = view.getInt32(36, true);

  if (version !== 2) {
    throw new Error(`Unsupported SPR version: ${version}. Only version 2 is supported.`);
  }

  // Palette
  const paletteOffset = 40;
  const paletteNumColors = view.getUint16(paletteOffset, true);
  if (paletteNumColors !== PALETTE_SIZE) {
    throw new Error(`Unexpected palette size: ${paletteNumColors}. Expected ${PALETTE_SIZE}.`);
  }
  const paletteDataOffset = paletteOffset + 2;
  const palette: [number, number, number][] = [];
  for (let i = 0; i < PALETTE_SIZE; i++) {
    const r = view.getUint8(paletteDataOffset + i * 3);
    const g = view.getUint8(paletteDataOffset + i * 3 + 1);
    const b = view.getUint8(paletteDataOffset + i * 3 + 2);
    palette.push([r, g, b]);
  }

  // Frames
  const frames: SprFrame[] = [];
  let frameDataOffset = paletteDataOffset + PALETTE_SIZE * 3;

  for (let i = 0; i < numFrames; i++) {
    const group = view.getInt32(frameDataOffset, true);
    const originX = view.getInt32(frameDataOffset + 4, true);
    const originY = view.getInt32(frameDataOffset + 8, true);
    const width = view.getInt32(frameDataOffset + 12, true);
    const height = view.getInt32(frameDataOffset + 16, true);
    frameDataOffset += 20;
    
    const frameSize = width * height;

    const imageData = new Uint8ClampedArray(frameSize * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = view.getUint8(frameDataOffset + x + y * width);
        const [r, g, b] = palette[index];
        const destPos = (x + y * width) * 4;
        imageData[destPos] = r;
        imageData[destPos + 1] = g;
        imageData[destPos + 2] = b;
        imageData[destPos + 3] = index === 255 ? 0 : 255; // Alpha
      }
    }
    
    // Create imageDataUrl
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        const img = new ImageData(imageData, width, height);
        ctx.putImageData(img, 0, 0);
    }

    frames.push({
      group,
      originX,
      originY,
      width,
      height,
      imageDataUrl: canvas.toDataURL('image/png'),
      size: frameSize
    });

    frameDataOffset += frameSize;
  }
  
  const typeMap: { [key: number]: string } = {
      0: 'vp_parallel_upright',
      1: 'facing_upright',
      2: 'vp_parallel',
      3: 'oriented',
      4: 'vp_parallel_oriented'
  };
  
  const texFormatMap: { [key: number]: string } = {
      0: 'Normal',
      1: 'Additive',
      2: 'IndexAlpha',
      3: 'AlphaTest'
  };
  
  const syncTypeMap: { [key: number]: string } = {
      0: 'sync',
      1: 'rand'
  };

  return {
    version,
    type: typeMap[type] || 'Unknown',
    texFormat: texFormatMap[texFormat] || 'Unknown',
    boundingRadius,
    maxWidth,
    maxHeight,
    numFrames,
    beamLength,
    syncType: syncTypeMap[syncType] || 'Unknown',
    palette,
    frames,
  };
}
