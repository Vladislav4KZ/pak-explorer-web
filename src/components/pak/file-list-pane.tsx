
'use client';

import { FileTree } from '@/components/pak/file-tree';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Check, ClipboardPaste, FolderPlus, Pencil, PlusCircle, X, FolderSymlink, ChevronDown, Plus } from 'lucide-react';
import type { PakFileEntry, FileTree as FileTreeType, ClipboardItem } from '@/types';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';

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
  onRenameStart: (path: string | null) => void;
  onRenameConfirm: (oldPath: string, newPath: string) => void;
  onDeleteStart: (path: string, type: 'file' | 'folder') => void;
  onMove: (sourcePath: string, destPath: string) => void;
  onClipboardAction: (type: 'copy' | 'cut', itemType: 'file' | 'folder', path: string) => void;
  onPaste: (destPath: string) => void;
  onFileDrop: (file: File, destPath?: string) => Promise<PakFileEntry | null>;
  onFolderDrop: (entry: FileSystemEntry, destPath?: string) => Promise<PakFileEntry[]>;
  onAddFile: () => void;
  onAddFolder: () => void;
  onExtract: (file: PakFileEntry) => void;
  onNewFolder: () => void;
  addBatchEntries: (entries: PakFileEntry[]) => void;
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
  onNewFolder,
  addBatchEntries,
  setIsRenamingPak,
  setPakName,
  toast,
  onExtract,
}: FileListPaneProps) {
    
  const getPakBaseName = (name: string) => name.replace(/\.(pak|pk3|zip)$/i, '');
    
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
      setPakName(trimmedName);
      toast({ title: "Archive Renamed", description: `Renamed to "${trimmedName}"` });
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropTarget(false);
    
    if ((e.target as HTMLElement).closest('[data-dnd-target="item"]')) {
      return;
    }

    const internalDragData = e.dataTransfer.getData('application/pak-explorer-item');
    if (internalDragData) {
      try {
        const data = JSON.parse(internalDragData);
        if (data.path) {
          onMove(data.path, ''); 
        }
      } catch (err) { console.error("Failed to parse drag data", err); }
      return;
    }

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const items = Array.from(e.dataTransfer.items);
      const entryPromises = items.map(item => {
          const entry = item.webkitGetAsEntry();
          if (!entry) return Promise.resolve(null);
          if (entry.isFile) {
              return new Promise<File>(res => (entry as FileSystemFileEntry).file(res))
                  .then(file => onFileDrop(file, ''));
          } else if (entry.isDirectory) {
              return onFolderDrop(entry, '');
          }
          return Promise.resolve(null);
      });

      const results = await Promise.all(entryPromises);
      const newEntries = results.flat().filter((e): e is PakFileEntry => e !== null);
      
      if (newEntries.length > 0) {
        addBatchEntries(newEntries);
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
      <div className="shrink-0 space-y-2 p-2 border-b">
        <TooltipProvider>
          <div className="flex gap-2">
              <Tooltip>
                  <TooltipTrigger asChild>
                      <Button onClick={onAddFile} className="flex-1">
                          <PlusCircle className="mr-2 h-4 w-4" /> Add Files
                      </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                      <p>Add files to the archive</p>
                  </TooltipContent>
              </Tooltip>
              <Tooltip>
                  <TooltipTrigger asChild>
                      <Button onClick={onAddFolder} className="flex-1" variant="outline">
                          <FolderSymlink className="mr-2 h-4 w-4" /> Add Folder
                      </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                      <p>Add contents of a folder</p>
                  </TooltipContent>
              </Tooltip>
          </div>
          <div className="flex">
              <Tooltip>
                  <TooltipTrigger asChild>
                          <Button onClick={onNewFolder} className="flex-1" variant="outline">
                          <FolderPlus className="mr-2 h-4 w-4" /> New Folder
                      </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                      <p>Create a new empty folder</p>
                  </TooltipContent>
              </Tooltip>
          </div>
        </TooltipProvider>
      </div>
       <div className='p-2 shrink-0'>
         {clipboard && (
          <Button
            onClick={() => onPaste('')}
            className="w-full"
            variant="secondary"
          >
            <ClipboardPaste className="mr-2 h-4 w-4" /> Paste to root
          </Button>
        )}
      </div>
      <ScrollArea 
        className="flex-1 min-h-0"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        >
        <div className={cn("p-2 pb-4 h-full", isDropTarget && 'bg-accent/20 rounded-md')}>
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
              onExtract={onExtract}
              addBatchEntries={addBatchEntries}
            />
          )}
          {pakEntries.length === 0 && (
            <div className="p-4 text-center italic text-muted-foreground h-full flex items-center justify-center">
              {isMobile ? "Tap 'Add Files' or 'Add Folder' to start." : "This archive is empty. Drag files here to add them."}
            </div>
          )}
        </div>
        <ScrollBar orientation="vertical" />
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
