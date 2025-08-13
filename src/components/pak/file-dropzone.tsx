
'use client';

import React, { useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';

interface FileDropzoneProps {
  onFileLoad: (file: File) => void;
  onItemDrop: (item: DataTransferItem) => void;
  icon: React.ReactNode;
  accept?: string;
}

export function FileDropzone({ onFileLoad, onItemDrop, icon, accept }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      onFileLoad(event.target.files[0]);
    }
  };

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      
      if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
        const firstItem = event.dataTransfer.items[0];
        
        // Heuristic to check if it's an archive file vs a folder/file to be added
        const isLikelyArchive = firstItem.kind === 'file' && (
          firstItem.type === 'application/zip' || 
          firstItem.type === 'application/x-zip-compressed' ||
          /\.(zip|pk3|pak)$/i.test(firstItem.getAsFile()?.name || '')
        );

        if (isLikelyArchive && event.dataTransfer.files.length === 1) {
           onFileLoad(event.dataTransfer.files[0]);
        } else {
           // Handle as file/folder to add to a new archive
           onItemDrop(firstItem);
        }
      }
    },
    [onFileLoad, onItemDrop]
  );

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <Card
      className="w-full max-w-lg cursor-pointer border-2 border-dashed bg-muted/50 transition-colors hover:border-primary hover:bg-muted"
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <CardContent className="flex flex-col items-center justify-center space-y-4 p-12 text-center">
        <div className="text-primary">{icon}</div>
        <div className="text-center text-muted-foreground">
            <p className="font-semibold text-foreground">
              {isMobile ? 'Tap to open an archive' : 'Drag & drop an archive here to open'}
            </p>
            {!isMobile && <p className="text-sm">or drop files/folders to create a new one</p>}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleFileChange}
        />
      </CardContent>
    </Card>
  );
}

    