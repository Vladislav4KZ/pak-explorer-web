
'use client';

import { FileTree } from '@/components/pak/file-tree';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Check, ClipboardPaste, FolderPlus, Pencil, PlusCircle, X } from 'lucide-react';
import type { PakFileEntry, FileTree as FileTreeType, ClipboardItem } from '@/types';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface FileListPaneProps {
  pakName: string;
  isDirty: boolean;
  pakEntries: PakFileEntry[];
  fileTree: FileTreeType | null;
  selectedFile: PakFileEntry | null;
  renamingPath: string | null;
  clipboard: ClipboardItem;
  isRenamingPak: boolean;

  onSelectFile: (file: PakFileEntry) => void;
  onRenameStart: (path: string) => void;
  onRenameConfirm: (oldPath: string, newPath: string) => void;
  onDeleteStart: (path: string, type: 'file' | 'folder') => void;
  onMove: (sourcePath: string, destPath: string) => void;
  onClipboardAction: (type: 'copy' | 'cut', itemType: 'file' | 'folder', path: string) => void;
  onPaste: (destPath: string) => void;
  onFileDrop: (file: File, destPath?: string) => void;
  onFolderDrop: (entry: FileSystemEntry, destPath?: string) => void;
  onAddFile: () => void;
  onAddFolder: () => void;
  setIsRenamingPak: (isRenaming: boolean) => void;
  setPakName: (name: string) => void;
  toast: (options: { title: string, description: string, variant?: 'destructive' }) => void;
}

export function FileListPane({
  pakName,
  isDirty,
  pakEntries,
  fileTree,
  selectedFile,
  renamingPath,
  clipboard,
  isRenamingPak,
  onSelectFile,
  onRenameStart,
  onRenameConfirm,
  onDeleteStart,
  onMove,
  onClipboardAction,
  onPaste,
  onFileDrop,
  onFolderDrop,
  onAddFile,
  onAddFolder,
  setIsRenamingPak,
  setPakName,
  toast,
}: FileListPaneProps) {
    
  const getPakBaseName = (name: string) => name.replace(/\.(pak|pk3|zip)$/i, '');
  const getPakExtension = (name: string) => name.split('.').pop() || 'pak';
    
  const [tempPakName, setTempPakName] = useState(getPakBaseName(pakName));
  const [isDropTarget, setIsDropTarget] = useState(false);
  const isMobile = useIsMobile();

  const handleRenameStart = () => {
    setTempPakName(getPakBaseName(pakName));
    setIsRenamingPak(true);
  };

  const handleRenameCancel = () => {
    setIsRenamingPak(false);
  };

  const handleRenameSave = () => {
    const trimmedName = tempPakName.trim();
    if (trimmedName && trimmedName !== getPakBaseName(pakName)) {
      const extension = getPakExtension(pakName);
      const newFullName = `${trimmedName}.${extension}`;
      setPakName(newFullName);
      toast({ title: "Archive Renamed", description: `Renamed to "${newFullName}"` });
    }
    setIsRenamingPak(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropTarget(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropTarget(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropTarget(false);
    
    // Prevent drop on specific items by letting them handle it
    if ((e.target as HTMLElement).closest('[data-dnd-target="item"]')) {
      return;
    }

    const internalDragData = e.dataTransfer.getData('application/pak-explorer-item');
    if (internalDragData) {
      // It's a move, and we are in the root
      try {
        const data = JSON.parse(internalDragData);
        if (data.path) {
          onMove(data.path, ''); 
        }
      } catch (err) { console.error("Failed to parse drag data", err); }
      return;
    }

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const entry = e.dataTransfer.items[0].webkitGetAsEntry();
      if (entry?.isFile) {
         (entry as FileSystemFileEntry).file(file => onFileDrop(file, ''));
      } else if (entry?.isDirectory) {
        onFolderDrop(entry, '');
      }
    }
  };


  return (
    <div className="flex h-full w-full flex-col">
      <div className="shrink-0 border-b p-4">
        {isRenamingPak ? (
          <div className="flex items-center gap-2">
            <Input
              value={tempPakName}
              onChange={(e) => setTempPakName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSave();
                if (e.key === 'Escape') handleRenameCancel();
              }}
              className="text-lg font-semibold"
              autoFocus
              onFocus={(e) => e.target.select()}
            />
            <Button variant="ghost" size="icon" onClick={handleRenameSave} className='h-8 w-8 flex-shrink-0'>
                <Check className='h-5 w-5 text-green-500' />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleRenameCancel} className='h-8 w-8 flex-shrink-0'>
                <X className='h-5 w-5 text-red-500' />
            </Button>
          </div>
        ) : (
          <div className="group flex items-center">
            <h2
              className="flex-1 truncate text-lg font-semibold"
              title={pakName + (isDirty ? '*' : '')}
              onClick={handleRenameStart}
            >
              {getPakBaseName(pakName)}
              {isDirty && '*'}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100"
              onClick={handleRenameStart}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          {pakEntries.filter((e) => e.name !== '.placeholder').length} items
        </p>
      </div>
      <div className="flex shrink-0 gap-2 p-2">
        <Button onClick={onAddFile} className="flex-1">
          <PlusCircle className="mr-2 h-4 w-4" /> Add File
        </Button>
        <Button onClick={onAddFolder} className="flex-1" variant="outline">
          <FolderPlus className="mr-2 h-4 w-4" /> New Folder
        </Button>
        {clipboard && (
          <Button
            onClick={() => onPaste('')}
            className="flex-1"
            variant="secondary"
          >
            <ClipboardPaste className="mr-2 h-4 w-4" /> Paste
          </Button>
        )}
      </div>
      <ScrollArea 
        className="flex-1 min-h-0"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        >
        <div className={cn("px-2 pb-4 h-full", isDropTarget && 'bg-accent/50 rounded-md')}>
          {fileTree && (
            <FileTree
              tree={fileTree}
              onSelectFile={onSelectFile}
              selectedPath={selectedFile?.path}
              renamingPath={renamingPath}
              onRenameStart={onRenameStart}
              onRenameConfirm={onRenameConfirm}
              onDeleteStart={onDeleteStart}
              onMove={onMove}
              clipboard={clipboard}
              onClipboardAction={onClipboardAction}
              onPaste={onPaste}
              onFileDrop={onFileDrop}
              onFolderDrop={onFolderDrop}
            />
          )}
          {pakEntries.length === 0 && (
            <div className="p-4 text-center italic text-muted-foreground h-full flex items-center justify-center">
              {isMobile ? "Tap 'Add File' to start." : "This archive is empty. Drag files here to add them."}
            </div>
          )}
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </div>
  );
}
