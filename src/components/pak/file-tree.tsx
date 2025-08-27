
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronRight, File as FileIcon, Folder, ImageIcon, FileText, Pencil, Trash2, MoreVertical, Music, Copy, Scissors, ClipboardPaste, Download } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { FileTree as FileTreeType, PakFileEntry, FileTreeNode, ClipboardItem } from '@/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

interface FileTreeProps {
  tree: FileTreeType;
  onSelectFile: (file: PakFileEntry) => void;
  selectedPath?: string | null;
  renamingPath: string | null;
  onRenameStart: (path: string | null) => void;
  onRenameConfirm: (oldPath: string, newPath: string) => void;
  onDeleteStart: (path: string, type: 'file' | 'folder') => void;
  onMove: (sourcePath: string, destPath: string) => void;
  clipboard: ClipboardItem;
  onClipboardAction: (type: 'copy' | 'cut', itemType: 'file' | 'folder', path: string) => void;
  onPaste: (destPath: string) => void;
  onFileDrop: (file: File, destPath?: string) => Promise<PakFileEntry | null>;
  onFolderDrop: (entry: FileSystemEntry, destPath?: string) => Promise<PakFileEntry[]>;
  addBatchEntries: (entries: PakFileEntry[]) => void;
  onExtract?: (file: PakFileEntry) => void;
}

const getIcon = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tga'].includes(ext)) {
    return <ImageIcon className="h-4 w-4 text-blue-400" />;
  }
  if (['wav', 'mp3', 'ogg', 'opus'].includes(ext)) {
    return <Music className="h-4 w-4 text-purple-400" />;
  }
   if (['spr'].includes(ext)) {
    return <ImageIcon className="h-4 w-4 text-orange-400" />;
  }
  if (['txt', 'md', 'cfg', 'rc', 'bat', 'sh', 'log'].includes(ext)) {
    return <FileText className="h-4 w-4 text-green-400" />;
  }
  return <FileIcon className="h-4 w-4 text-muted-foreground" />;
};

const activeRenameSubmitRef: React.MutableRefObject<(() => void) | null> = { current: null };

const RenameInput = ({ name, onRenameConfirm, onCancel, path }: { name: string; path: string; onRenameConfirm: (oldPath: string, newPath: string) => void; onCancel: () => void; }) => {
    const [newName, setNewName] = useState(name);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = useCallback(() => {
        const pathParts = path.split('/');
        const oldName = pathParts.pop();
        const trimmedNewName = newName.trim();
        if (trimmedNewName && trimmedNewName !== oldName) {
            pathParts.push(trimmedNewName);
            onRenameConfirm(path, pathParts.join('/'));
        } else {
            onCancel();
        }
    }, [newName, path, onRenameConfirm, onCancel]);

    useEffect(() => {
        activeRenameSubmitRef.current = handleSubmit;

        const animationFrame = requestAnimationFrame(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
        });
        
        const handleMouseDown = (event: MouseEvent) => {
            if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
                handleSubmit();
            }
        };

        document.addEventListener('mousedown', handleMouseDown);

        return () => {
            cancelAnimationFrame(animationFrame);
            document.removeEventListener('mousedown', handleMouseDown);
            if (activeRenameSubmitRef.current === handleSubmit) {
                activeRenameSubmitRef.current = null;
            }
        };
    }, [path, name, handleSubmit]);


    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSubmit();
        } else if (e.key === 'Escape') {
            onCancel();
        }
    };

    return (
        <Input
            ref={inputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-7 ml-1 flex-1"
        />
    );
};


const FileTreeItem = ({
  node,
  onSelectFile,
  selectedPath,
  renamingPath,
  onRenameStart,
  onRenameConfirm,
  onDeleteStart,
  onMove,
  clipboard,
  onClipboardAction,
  onPaste,
  onFileDrop,
  onFolderDrop,
  addBatchEntries,
  onExtract,
}: {
  node: FileTreeNode;
  onSelectFile: (file: PakFileEntry) => void;
  selectedPath?: string | null;
  renamingPath: string | null;
  onRenameStart: (path: string | null) => void;
  onRenameConfirm: (oldPath: string, newPath: string) => void;
  onDeleteStart: (path: string, type: 'file' | 'folder') => void;
  onMove: (sourcePath: string, destPath: string) => void;
  clipboard: ClipboardItem;
  onClipboardAction: (type: 'copy' | 'cut', itemType: 'file' | 'folder', path: string) => void;
  onPaste: (destPath: string) => void;
  onFileDrop: (file: File, destPath?: string) => Promise<PakFileEntry | null>;
  onFolderDrop: (entry: FileSystemEntry, destPath?: string) => Promise<PakFileEntry[]>;
  addBatchEntries: (entries: PakFileEntry[]) => void;
  onExtract?: (file: PakFileEntry) => void;
}) => {

  const [isOpen, setIsOpen] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;
  const isRenaming = renamingPath === node.path;

  const handleDragStart = (e: React.DragEvent) => {
      e.dataTransfer.setData('application/pak-explorer-item', JSON.stringify({ path: node.path, type: node.type }));
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (node.type === 'folder') {
        const isInternalMove = e.dataTransfer.types.includes('application/pak-explorer-item');
        e.dataTransfer.dropEffect = isInternalMove ? 'move' : 'copy';
        setIsDropTarget(true);
    } else {
        e.dataTransfer.dropEffect = 'none';
    }
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
    
    if (node.type !== 'folder') return;
    
    const internalDragData = e.dataTransfer.getData('application/pak-explorer-item');
    if (internalDragData) {
        try {
          const data = JSON.parse(internalDragData);
          if (data.path && data.path !== node.path) {
            onMove(data.path, node.path);
          }
        } catch (err) {
            console.error("Failed to parse drag data", err);
        }
        return;
    }
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const items = Array.from(e.dataTransfer.items);
      const entryPromises = items.map(item => {
          const entry = item.webkitGetAsEntry();
          if (!entry) return Promise.resolve(null);
          if (entry.isFile) {
              return new Promise<File>(res => (entry as FileSystemFileEntry).file(res))
                  .then(file => onFileDrop(file, node.path));
          } else if (entry.isDirectory) {
              return onFolderDrop(entry, node.path);
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
  
  const dragAndDropProps = isTouchDevice ? {} : {
    draggable: !isRenaming,
    onDragStart: handleDragStart,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  };

  if (node.name === '.placeholder') {
      return null;
  }

  const handleItemClick = (e: React.MouseEvent) => {
    if (isRenaming) {
        e.stopPropagation();
        return;
    }
    
    if (node.type === 'file') {
      onSelectFile(node.file!);
    }
  };
  
  const triggerContent = (
      <div
          onClick={handleItemClick}
          className={cn('flex flex-1 w-full min-w-0 items-center rounded-md text-left text-sm',
              selectedPath === node.path && !isRenaming ? 'bg-primary/20' : '',
              isDropTarget && 'bg-accent ring-1 ring-primary/50'
          )}
      >
        <div className={cn('flex items-center gap-2 flex-1 min-w-0 p-1.5', isRenaming && 'py-0 pl-1.5 pr-1')}>
          {node.type === 'folder' ? (
              <ChevronRight className={cn('h-4 w-4 shrink-0 transition-transform duration-200', isOpen && 'rotate-90')} />
          ) : <span className="w-4 shrink-0" />}
          
          <div className='shrink-0'>
            {node.type === 'folder' ? <Folder className="h-4 w-4 text-yellow-500" /> : getIcon(node.name)}
          </div>

          {isRenaming ? (
              <RenameInput name={node.name} path={node.path} onRenameConfirm={onRenameConfirm} onCancel={() => onRenameStart(null)} />
          ) : (
              <span className="truncate flex-1">{node.name}</span>
          )}
        </div>
      </div>
  );
  
  const handleMenuButtonPointerDown = (e: React.PointerEvent) => {
    if (renamingPath && renamingPath !== node.path) {
        activeRenameSubmitRef.current?.();
    } else if (isRenaming) {
        activeRenameSubmitRef.current?.();
    }
  };
  
  const handleRenameRequest = (e: React.SyntheticEvent) => {
      e.preventDefault();
      onRenameStart(node.path);
  }

  const actionsMenu = (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 flex-shrink-0 opacity-50 hover:opacity-100 touch-device:opacity-100"
                onPointerDown={handleMenuButtonPointerDown}
            >
                <MoreVertical className="h-4 w-4" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
            onCloseAutoFocus={(e) => {
                // When we start renaming, we don't want the trigger to be re-focused.
                // The focus will be managed by the RenameInput component.
                if (renamingPath) {
                    e.preventDefault();
                }
            }}
        >
            {node.type === 'file' && (
              <DropdownMenuItem onSelect={() => node.file && onExtract && onExtract(node.file)}>
                <Download className="mr-2 h-4 w-4" />
                Extract
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onRenameStart(node.path)}>
                <Pencil className="mr-2 h-4 w-4" />
                Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onClipboardAction('copy', node.type, node.path)}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onClipboardAction('cut', node.type, node.path)}>
                <Scissors className="mr-2 h-4 w-4" />
                Cut
            </DropdownMenuItem>
            {node.type === 'folder' && clipboard && (
                 <DropdownMenuItem onClick={() => onPaste(node.path)}>
                    <ClipboardPaste className="mr-2 h-4 w-4" />
                    Paste
                </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDeleteStart(node.path, node.type)} className="text-red-500 focus:text-red-500 focus:bg-destructive/20">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
  );

  if (node.type === 'folder') {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div 
          className={cn(
              "flex items-center group rounded-md",
              !isRenaming && "hover:bg-accent/50",
          )}
          ref={itemRef} 
          {...dragAndDropProps}
          data-dnd-target="item"
          >
           <CollapsibleTrigger asChild>
             <button className='flex flex-1 w-full min-w-0' onClick={(e) => {
                 if (isRenaming) {
                     e.preventDefault();
                     return;
                 }
                 setIsOpen(!isOpen);
             }}>
                {triggerContent}
             </button>
           </CollapsibleTrigger>
            <div className="pr-2">
                {actionsMenu}
            </div>
        </div>
        <CollapsibleContent>
            <FileTreeBranch 
                tree={node.children || {}}
                parentPath={node.path}
                onSelectFile={onSelectFile} 
                selectedPath={selectedPath} 
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
                addBatchEntries={addBatchEntries}
            />
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div 
      className={cn(
          "flex items-center group rounded-md",
          !isRenaming && "hover:bg-accent/50",
      )}
      ref={itemRef} 
      {...dragAndDropProps}
      data-dnd-target="item"
    >
        <div className='flex flex-1 w-full min-w-0'>
             {triggerContent}
        </div>
        <div className="pr-2">
            {actionsMenu}
        </div>
    </div>
  );
};

const FileTreeBranch = ({ tree, parentPath, ...props }: { tree: FileTreeType; parentPath?: string } & Omit<FileTreeProps, 'tree'> & { className?: string, isRoot?: boolean }) => {
    const sortedNodes = Object.values(tree).sort((a, b) => {
        if (a.type === 'folder' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
    const [isDropTarget, setIsDropTarget] = useState(false);

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDropTarget(false);

        if (!parentPath) return;

        const internalDragData = e.dataTransfer.getData('application/pak-explorer-item');
        if (internalDragData) {
            try {
                const data = JSON.parse(internalDragData);
                if (data.path && data.path !== parentPath && !parentPath.startsWith(data.path + '/')) {
                    props.onMove(data.path, parentPath);
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
                        .then(file => props.onFileDrop(file, parentPath));
                } else if (entry.isDirectory) {
                    return props.onFolderDrop(entry, parentPath);
                }
                return Promise.resolve(null);
            });

            const results = await Promise.all(entryPromises);
            const newEntries = results.flat().filter((e): e is PakFileEntry => e !== null);
            
            if (newEntries.length > 0) {
                props.addBatchEntries(newEntries);
            }
        }
    };
    
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const isInternalMove = e.dataTransfer.types.includes('application/pak-explorer-item');
        e.dataTransfer.dropEffect = isInternalMove ? 'move' : 'copy';
        setIsDropTarget(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDropTarget(false);
    };

    return (
        <div 
          className={cn("space-y-1 py-1 pl-6", isDropTarget && 'bg-accent/20 rounded-md', props.className)}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {sortedNodes.map((node) => (
              <FileTreeItem 
                key={node.path} 
                node={node} 
                {...props}
              />
          ))}
        </div>
    );
};


export const FileTree = (props: Omit<FileTreeProps, 'addBatchEntries'> & { addBatchEntries: (entries: PakFileEntry[]) => void }) => {
  const { onFileDrop, onFolderDrop, addBatchEntries } = props;
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

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
          props.onMove(data.path, ''); 
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };
  
  const sortedNodes = Object.values(props.tree).sort((a, b) => {
        if (a.type === 'folder' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name, undefined, { numeric: true });
    });

  return (
    <div className='p-1 space-y-1' onDrop={handleDrop} onDragOver={handleDragOver}>
        {sortedNodes.map((node) => (
            <FileTreeItem key={node.path} node={node} {...props} />
        ))}
    </div>
  );
};
