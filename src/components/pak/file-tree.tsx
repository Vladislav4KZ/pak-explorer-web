
'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronRight, File as FileIcon, Folder, ImageIcon, FileText, Pencil, Trash2, MoreVertical, Music, Copy, Scissors, ClipboardPaste } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { FileTree as FileTreeType, PakFileEntry, FileTreeNode, ClipboardItem } from '@/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

interface FileTreeProps {
  tree: FileTreeType;
  onSelectFile: (file: PakFileEntry) => void;
  selectedPath?: string | null;
  renamingPath: string | null;
  onRenameStart: (path: string) => void;
  onRenameConfirm: (oldPath: string, newPath: string) => void;
  onDeleteStart: (path: string, type: 'file' | 'folder') => void;
  onMove: (sourcePath: string, destPath: string) => void;
  clipboard: ClipboardItem;
  onClipboardAction: (type: 'copy' | 'cut', itemType: 'file' | 'folder', path: string) => void;
  onPaste: (destPath: string) => void;
  onFileDrop: (file: File, destPath?: string) => void;
  onFolderDrop: (entry: FileSystemEntry, destPath?: string) => void;
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

const RenameInput = ({ node, onRenameConfirm, onCancel }: { node: FileTreeNode; onRenameConfirm: (oldPath: string, newPath: string) => void; onCancel: () => void; }) => {
    const [newName, setNewName] = useState(node.name);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    const handleSubmit = () => {
        const pathParts = node.path.split('/');
        const oldName = pathParts.pop();
        if (newName && newName !== oldName) {
            pathParts.push(newName);
            onRenameConfirm(node.path, pathParts.join('/'));
        } else {
            onCancel();
        }
    };
    
    const handleBlur = () => {
        handleSubmit();
    };

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
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="h-7 ml-6"
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
}: {
  node: FileTreeNode;
  onSelectFile: (file: PakFileEntry) => void;
  selectedPath?: string | null;
  renamingPath: string | null;
  onRenameStart: (path: string) => void;
  onRenameConfirm: (oldPath: string, newPath: string) => void;
  onDeleteStart: (path: string, type: 'file' | 'folder') => void;
  onMove: (sourcePath: string, destPath: string) => void;
  clipboard: ClipboardItem;
  onClipboardAction: (type: 'copy' | 'cut', itemType: 'file' | 'folder', path: string) => void;
  onPaste: (destPath: string) => void;
  onFileDrop: (file: File, destPath?: string) => void;
  onFolderDrop: (entry: FileSystemEntry, destPath?: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;

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

  const handleDrop = (e: React.DragEvent) => {
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
      const items = Array.from(e.dataTransfer.items).map(item => item.webkitGetAsEntry());
      if (items.length > 0 && items[0]) {
          const handleEntry = (entry: FileSystemEntry | null) => {
              if (!entry) return;
                if (entry.isFile) {
                  (entry as FileSystemFileEntry).file(file => {
                      onFileDrop(file, node.path);
                  });
              } else if (entry.isDirectory) {
                  onFolderDrop(entry, node.path);
              }
          };
          
          handleEntry(items[0]);
      }
    }
  };
  
  const dragAndDropProps = isTouchDevice ? {} : {
    draggable: true,
    onDragStart: handleDragStart,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  };

  if (renamingPath === node.path) {
    return <RenameInput node={node} onRenameConfirm={onRenameConfirm} onCancel={() => onRenameStart('')} />;
  }
  
  if (node.name === '.placeholder') {
      return null;
  }

  const triggerContent = (
    <div 
        data-dnd-target="item"
        className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
        selectedPath === node.path ? 'bg-primary/20' : 'hover:bg-accent',
        isDropTarget && 'bg-accent ring-2 ring-primary'
    )}>
        {node.type === 'folder' ? (
            <ChevronRight className={cn('h-4 w-4 shrink-0 transition-transform duration-200', isOpen && 'rotate-90')} />
        ) : <span className="w-4" />}
        
        {node.type === 'folder' ? <Folder className="h-4 w-4 text-yellow-500" /> : getIcon(node.name)}
        <span className="truncate flex-1">{node.name}</span>
    </div>
  );

  const actionsMenu = (
    <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 opacity-50 hover:opacity-100 touch-device:opacity-100">
                <MoreVertical className="h-4 w-4" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => onRenameStart(node.path)}>
                <Pencil className="mr-2 h-4 w-4" />
                Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
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

  const handleClick = () => {
    if(node.type === 'file') {
        onSelectFile(node.file!);
    } else {
        setIsOpen(!isOpen);
    }
  };

  if (node.type === 'folder') {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div 
          className="flex items-center group" 
          ref={itemRef} 
          {...dragAndDropProps}
          >
          <CollapsibleTrigger asChild>
              <button className="flex-1 w-full min-w-0" onClick={handleClick}>
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
            />
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div 
      className="flex items-center group" 
      ref={itemRef} 
      {...dragAndDropProps}
    >
        <button
            onClick={handleClick}
            className={'flex-1 w-full min-w-0'}
        >
            {triggerContent}
        </button>
        <div className="pr-2">
            {actionsMenu}
        </div>
    </div>
  );
};

const FileTreeBranch = ({ tree, parentPath, ...props }: Omit<FileTreeProps, 'tree'> & { className?: string, isRoot?: boolean, parentPath?: string }) => {
    const sortedNodes = Object.values(tree).sort((a, b) => {
        if (a.type === 'folder' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
    const [isDropTarget, setIsDropTarget] = useState(false);

    const handleDrop = (e: React.DragEvent) => {
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
            const entry = Array.from(e.dataTransfer.items)[0]?.webkitGetAsEntry();
            if (entry?.isFile) {
                (entry as FileSystemFileEntry).file(file => props.onFileDrop(file, parentPath));
            } else if (entry?.isDirectory) {
                props.onFolderDrop(entry, parentPath);
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
          className={cn("space-y-1 py-1 pl-6", isDropTarget && 'bg-accent/50 rounded-md', props.className)}
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


export const FileTree = (props: FileTreeProps) => {
  const { onFileDrop, onFolderDrop } = props;
  const handleDrop = (e: React.DragEvent) => {
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
      const entry = e.dataTransfer.items[0].webkitGetAsEntry();
      if (!entry) return;
      if (entry.isFile) {
         (entry as FileSystemFileEntry).file(file => onFileDrop(file, ''));
      } else if (entry.isDirectory) {
        onFolderDrop(entry, '');
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

