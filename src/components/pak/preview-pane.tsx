
'use client';

import { useEffect, useState, useRef, useCallback, memo } from 'react';
import { Download, FileQuestion, FileText, Music, ZoomIn, ZoomOut, RotateCcw, Play, Pause, ArrowLeftToLine, ArrowRightToLine, Rewind, FastForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import type { PakFileEntry, SprData } from '@/types';
import TgaLoader from 'tga-js';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { parseSpr } from '@/lib/spr-parser';
import { Slider } from '../ui/slider';


interface PreviewPaneProps {
  file: PakFileEntry | null;
  onExtract: (file: PakFileEntry) => void;
}

const isImage = (ext: string) => ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tga'].includes(ext);
const isText = (ext: string) => ['txt', 'md', 'cfg', 'rc', 'bat', 'sh', 'log'].includes(ext);
const isAudio = (ext: string) => ['wav', 'mp3', 'ogg', 'opus'].includes(ext);
const isSpr = (ext: string) => ext === 'spr';

// Panning and Zooming Hook
const useImageZoomPan = (isZoomable: boolean) => {
    const [zoom, setZoom] = useState(1);
    const [isPanning, setIsPanning] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [translate, setTranslate] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const isPanningRef = useRef(false);

    useEffect(() => {
        isPanningRef.current = isPanning;
    }, [isPanning]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isZoomable || zoom <= 1) return;
        e.preventDefault();
        setIsPanning(true);
        setStartPos({ x: e.clientX - translate.x, y: e.clientY - translate.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isPanningRef.current || !containerRef.current) return;
        e.preventDefault();
        setTranslate({
            x: e.clientX - startPos.x,
            y: e.clientY - startPos.y
        });
    };

    const handleMouseUp = () => {
        setIsPanning(false);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (!isZoomable || zoom <= 1 || e.touches.length !== 1) return;
        const touch = e.touches[0];
        setIsPanning(true);
        setStartPos({ x: touch.clientX - translate.x, y: touch.clientY - translate.y });
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isPanningRef.current || !containerRef.current || e.touches.length !== 1) return;
        const touch = e.touches[0];
        setTranslate({
            x: touch.clientX - startPos.x,
            y: touch.clientY - startPos.y
        });
    };

    const handleTouchEnd = () => {
        setIsPanning(false);
    };
  
    const resetZoomAndPan = useCallback(() => {
        setZoom(1);
        setTranslate({ x: 0, y: 0 });
    }, []);

    const zoomIn = () => setZoom(z => z * 1.25);
    const zoomOut = () => setZoom(z => z / 1.25);
    
    const panProps = {
        onMouseDown: handleMouseDown,
        onMouseMove: handleMouseMove,
        onMouseUp: handleMouseUp,
        onMouseLeave: handleMouseUp,
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
    };

    return { zoom, translate, containerRef, panProps, resetZoomAndPan, setZoom, zoomIn, zoomOut, isPanning };
};

const SprPreview = memo(function SprPreview({ sprData, fileName }: { sprData: SprData; fileName: string; }) {
    const { zoom, translate, containerRef, panProps, resetZoomAndPan, zoomIn, zoomOut, isPanning } = useImageZoomPan(true);
    const [sprFrame, setSprFrame] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const animationRef = useRef<NodeJS.Timeout>();

    useEffect(() => {
        setSprFrame(0);
        setIsPlaying(true);
        resetZoomAndPan();
    }, [sprData, resetZoomAndPan]);

    useEffect(() => {
        if (isPlaying && sprData && sprData.frames.length > 1) {
            animationRef.current = setInterval(() => {
                setSprFrame(prev => (prev + 1) % sprData.frames.length);
            }, 1000 / (sprData.syncType === 'sync' ? 10 : 20));
        } else {
            if (animationRef.current) {
                clearInterval(animationRef.current);
            }
        }
        return () => {
             if (animationRef.current) {
                clearInterval(animationRef.current);
            }
        }
    }, [isPlaying, sprData]);
  
    const currentFrameImage = sprData.frames[sprFrame]?.imageDataUrl;
    
    const nextFrame = () => {
      setIsPlaying(false);
      setSprFrame(prev => (prev + 1) % sprData.frames.length);
    };

    const prevFrame = () => {
      setIsPlaying(false);
      setSprFrame(prev => (prev - 1 + sprData.frames.length) % sprData.frames.length);
    };
    
    const restartAnimation = () => {
        setIsPlaying(false);
        setSprFrame(0);
    };

    const controls = (
        <>
            <div className="flex items-center gap-1 rounded-md border bg-background p-0.5">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomIn}><ZoomIn className="h-4 w-4"/></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomOut}><ZoomOut className="h-4 w-4"/></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetZoomAndPan}><RotateCcw className="h-4 w-4"/></Button>
            </div>
        </>
    );
    
    return (
      <div className="flex flex-col h-full">
        <header className="flex-shrink-0 border-b p-2 md:p-4 flex items-center justify-between">
            <div className="min-w-0 flex-1">
                 <CardTitle className="truncate text-base md:text-lg" title={fileName}>{fileName}</CardTitle>
                 <CardDescription>{(sprData.frames[sprFrame]?.size / 1024).toFixed(2)} KB</CardDescription>
            </div>
            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                {controls}
            </div>
        </header>
        <div 
          ref={containerRef}
          className={cn("relative h-full w-full overflow-hidden flex items-center justify-center p-2 flex-1 bg-muted/20", panProps.onMouseDown && "cursor-grab", isPanning && "cursor-grabbing")}
          {...panProps}
        >
            {currentFrameImage ? (
                <img
                  src={currentFrameImage}
                  alt={`Frame ${sprFrame + 1} of ${fileName}`}
                  className="max-h-full max-w-full object-contain transition-transform duration-200"
                  style={{ transform: `scale(${zoom}) translate(${translate.x}px, ${translate.y}px)`, imageRendering: 'pixelated' }}
                  draggable={false}
                />
            ) : (
                 <div className="text-muted-foreground">Error loading frame</div>
            )}
        </div>
        <div className="p-2 md:p-4 border-t bg-background/50">
            <div className='flex items-center gap-4 justify-center md:justify-start flex-wrap'>
                 <div className="flex items-center gap-2">
                    <Button variant="ghost" size="lg" className="h-12 w-12" onClick={restartAnimation} title="Restart">
                        <RotateCcw className="h-6 w-6" />
                    </Button>
                    <Button variant="ghost" size="lg" className="h-12 w-12" onClick={prevFrame} title="Previous Frame">
                        <Rewind className="h-6 w-6" />
                    </Button>
                    <Button variant="ghost" size="lg" className="h-12 w-12" onClick={() => setIsPlaying(p => !p)} title={isPlaying ? 'Pause' : 'Play'}>
                        {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                    </Button>
                     <Button variant="ghost" size="lg" className="h-12 w-12" onClick={nextFrame} title="Next Frame">
                        <FastForward className="h-6 w-6" />
                    </Button>
                </div>
                 <div className="flex-1 flex flex-col items-center gap-1 min-w-[150px] max-w-xs mx-auto">
                    <span className="text-sm font-mono whitespace-nowrap">{sprFrame + 1} / {sprData.frames.length}</span>
                     <Slider
                        value={[sprFrame]}
                        max={sprData.frames.length > 0 ? sprData.frames.length - 1 : 0}
                        step={1}
                        onValueChange={(value) => { setIsPlaying(false); setSprFrame(value[0]); }}
                        className="w-full"
                    />
                </div>
            </div>
            <div className="text-xs text-muted-foreground mt-2 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
                 <span>Type: {sprData.type}</span>
                 <span>Format: {sprData.texFormat}</span>
                 <span>Sync: {sprData.syncType}</span>
                 <span>Frames: {sprData.numFrames}</span>
            </div>
        </div>
      </div>
    )
});


const AudioPreview = memo(function AudioPreview({ file, contentUrl }: { file: PakFileEntry; contentUrl: string }) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const setAudioData = () => setDuration(audio.duration);
        const setAudioTime = () => setCurrentTime(audio.currentTime);
        const handleEnded = () => setIsPlaying(false);

        audio.addEventListener('loadedmetadata', setAudioData);
        audio.addEventListener('timeupdate', setAudioTime);
        audio.addEventListener('ended', handleEnded);

        // Reset state when file changes
        setIsPlaying(false);
        setCurrentTime(0);
        if (audio.readyState > 0) {
            setAudioData();
        }

        return () => {
            audio.removeEventListener('loadedmetadata', setAudioData);
            audio.removeEventListener('timeupdate', setAudioTime);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [contentUrl]);

    const togglePlayPause = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (isPlaying) {
            audio.pause();
        } else {
            audio.play();
        }
        setIsPlaying(!isPlaying);
    };

    const seek = (amount: number) => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = Math.max(0, Math.min(duration, audio.currentTime + amount));
    };
    
    const handleSliderChange = (value: number[]) => {
         const audio = audioRef.current;
         if (!audio) return;
         audio.currentTime = value[0];
         setCurrentTime(value[0]);
    };

    const formatTime = (timeInSeconds: number) => {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col items-center justify-center p-4 md:p-8 text-center h-full">
            <Music className="h-24 w-24 md:h-32 md:w-32 text-muted-foreground" />
            <p className="text-lg font-medium mt-4">{file.name}</p>
            <audio ref={audioRef} src={contentUrl} className="hidden" />
            
            <div className="w-full max-w-md mt-6 space-y-4">
                 <div className="w-full">
                     <Slider
                        value={[currentTime]}
                        max={duration || 0}
                        step={0.1}
                        onValueChange={handleSliderChange}
                        className="w-full"
                    />
                    <div className="flex justify-between text-xs font-mono text-muted-foreground mt-1.5">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>
                <div className="flex items-center justify-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => seek(-10)}>
                        <Rewind className="h-6 w-6" />
                    </Button>
                     <Button variant="ghost" size="icon" className="h-14 w-14" onClick={togglePlayPause}>
                        {isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => seek(10)}>
                        <FastForward className="h-6 w-6" />
                    </Button>
                </div>
            </div>
        </div>
    );
});


export function PreviewPane({ file, onExtract }: PreviewPaneProps) {
  const [contentUrl, setContentUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [sprData, setSprData] = useState<SprData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const { zoom, translate, containerRef, panProps, resetZoomAndPan, zoomIn, zoomOut, isPanning } = useImageZoomPan(!!file && isImage(file.name.split('.').pop()!));
  
  const memoizedResetZoomAndPan = useCallback(resetZoomAndPan, []);

  useEffect(() => {
    let currentContentUrl = contentUrl;
    // Clean up previous content URL
    if (currentContentUrl && currentContentUrl.startsWith('blob:')) {
      URL.revokeObjectURL(currentContentUrl);
    }
    
    setContentUrl(null);
    setTextContent(null);
    setSprData(null);
    setError(null);
    memoizedResetZoomAndPan();

    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';

      if (isText(ext)) {
        const decoder = new TextDecoder('utf-8', { fatal: true });
        try {
          setTextContent(decoder.decode(file.data));
        } catch (e) {
          setError('Could not decode file as UTF-8 text.');
        }
      } else if (isImage(ext) || isAudio(ext)) {
        if (ext === 'tga') {
          try {
            const tga = new TgaLoader();
            tga.load(new Uint8Array(file.data));
            const newUrl = tga.getDataURL('image/png');
            setContentUrl(newUrl);
            currentContentUrl = newUrl;
          } catch(e) {
            console.error("TGA parsing error:", e);
            setError('Could not parse TGA file.');
          }
        } else {
            const mimeType = ext === 'wav' ? 'audio/wav' : undefined; // Let browser infer for others
            const blob = new Blob([file.data], { type: mimeType });
            const newUrl = URL.createObjectURL(blob);
            setContentUrl(newUrl);
            currentContentUrl = newUrl;
        }
      } else if (isSpr(ext)) {
          try {
            const parsedSpr = parseSpr(file.data);
            setSprData(parsedSpr);
          } catch (e) {
            console.error("SPR parsing error:", e);
            setError(e instanceof Error ? e.message : 'Could not parse SPR file.');
          }
      }
      else {
        setError('Preview for this file type is not supported.');
      }
    }
    
    // Cleanup function
    return () => {
      if (currentContentUrl && currentContentUrl.startsWith('blob:')) {
        URL.revokeObjectURL(currentContentUrl);
      }
    };
  }, [file, memoizedResetZoomAndPan]);
  
  const renderContent = () => {
    if (!file) {
      return (
         <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <FileText className="h-16 w-16 text-muted-foreground" />
             {isMobile ? (
                <>
                    <p className="mt-4 text-lg font-medium">Select a file to preview</p>
                    <p className="text-sm text-muted-foreground">You can extract it or view its contents.</p>
                </>
             ) : (
                <>
                    <p className="mt-4 text-lg font-medium">Select a file to preview</p>
                    <p className="text-sm text-muted-foreground">or drag files into the list to add them.</p>
                </>
             )}
         </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground h-full">
          <FileQuestion className="h-16 w-16" />
          <p className="mt-4 text-lg">{error}</p>
        </div>
      );
    }
    
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (sprData) {
        return <SprPreview sprData={sprData} fileName={file.name} />;
    }

    if (isImage(ext) && contentUrl) {
      return (
        <div 
          ref={containerRef}
          className={cn("relative h-full w-full overflow-hidden flex items-center justify-center p-2 bg-muted/20", panProps.onMouseDown && "cursor-grab", isPanning && "cursor-grabbing")}
          {...panProps}
        >
            <img
              src={contentUrl}
              alt={`Preview of ${file.name}`}
              className="max-h-full max-w-full object-contain transition-transform duration-200"
              style={{ transform: `scale(${zoom}) translate(${translate.x}px, ${translate.y}px)` }}
              draggable={false}
            />
        </div>
      );
    }
    
    if (isAudio(ext) && contentUrl) {
        return <AudioPreview file={file} contentUrl={contentUrl} />;
    }

    if (isText(ext) && textContent) {
      return (
        <ScrollArea className="h-full w-full">
          <div className="p-4 w-fit min-w-full bg-muted/20">
             <pre className="text-sm font-mono whitespace-pre">{textContent}</pre>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      );
    }
    
    return (
        <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground h-full">
            <FileQuestion className="h-16 w-16" />
            <p className="mt-4 text-lg">Loading preview...</p>
        </div>
    );
  };
  

  const ext = file?.name.split('.').pop()?.toLowerCase() || '';
  const showImageControls = file && isImage(ext);

  if (sprData) {
      return <SprPreview sprData={sprData} fileName={file!.name} />
  }

  if (isAudio(ext) && contentUrl) {
      return <AudioPreview file={file!} contentUrl={contentUrl} />;
  }


  return (
    <div className="flex h-full flex-col">
       {file && (
        <header className="flex-shrink-0 border-b p-2 md:p-4 flex items-center justify-between">
           <div className="flex items-center gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                    <CardTitle className="truncate text-base md:text-lg" title={file.path}>{file.name}</CardTitle>
                    <CardDescription>{(file.size / 1024).toFixed(2)} KB</CardDescription>
                </div>
           </div>

            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                {showImageControls && (
                <div className="flex items-center gap-1 rounded-md border bg-background p-0.5">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomIn}><ZoomIn className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomOut}><ZoomOut className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetZoomAndPan}><RotateCcw className="h-4 w-4"/></Button>
                </div>
                )}
                <Button variant="outline" size="sm" onClick={() => onExtract(file)}>
                <Download className="mr-0 md:mr-2 h-4 w-4" />
                <span className="hidden md:inline">Extract</span>
                </Button>
            </div>
        </header>
       )}
      <div className={cn("flex-1 overflow-auto", !file && "md:flex md:items-center md:justify-center")}>
        {renderContent()}
      </div>
    </div>
  );
}
