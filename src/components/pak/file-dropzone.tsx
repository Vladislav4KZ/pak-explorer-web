
'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FileDropzoneProps {
  onFileLoad: (file: File) => void;
  onItemDrop: (items: DataTransferItemList) => void;
  icon: React.ReactNode;
  message: React.ReactNode;
  accept?: string;
}

export function FileDropzone({ onFileLoad, onItemDrop, icon, message, accept }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      onFileLoad(event.target.files[0]);
    }
  };

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);
      
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
           onItemDrop(event.dataTransfer.items);
        }
      }
    },
    [onFileLoad, onItemDrop]
  );

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  };
  
  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <Card
      className={cn("w-full max-w-lg cursor-pointer border-2 border-dashed bg-muted/50 transition-colors hover:border-primary",
        isDragOver && "border-primary bg-primary/10 ring-2 ring-primary/50"
      )}
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <CardContent className="flex flex-col items-center justify-center space-y-4 p-12 text-center">
        <div className="text-primary">{icon}</div>
        {message}
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
