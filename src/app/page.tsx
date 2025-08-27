
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Box, UploadCloud, PlusCircle, FolderOpen, Menu, Loader2, MoreVertical, FileArchive, FolderPlus, FolderSymlink } from 'lucide-react';
import { FileDropzone } from '@/components/pak/file-dropzone';
import { PreviewPane } from '@/components/pak/preview-pane';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { parsePak, createPak, buildFileTree as buildFileTreeUtil, parseZip, createZip } from '@/lib/pak-parser';
import type { PakFileEntry, FileTree as FileTreeType, ArchiveType, ClipboardItem, ConflictFile } from '@/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AddFolderDialog } from '@/components/pak/add-folder-dialog';
import { SaveDialog, type SaveOptions } from '@/components/pak/save-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { UnsavedChangesDialog } from '@/components/pak/unsaved-changes-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { FileListPane } from '@/components/pak/file-list-pane';
import { MobileSidebar } from '@/components/pak/mobile-sidebar';
import { ReplaceConfirmationDialog } from '@/components/pak/replace-confirmation-dialog';

type AppState = 'empty' | 'loaded';


type PendingAction = {
    type: 'open_file';
    file: File;
} | {
    type: 'new_archive';
    archiveType: ArchiveType;
} | null;

type ReplaceAllStrategy = 'replace' | 'skip' | null;

const isArchiveFile = (fileName: string): boolean => {
    return /\.(pak|pk3|zip)$/i.test(fileName);
}


async function* getFilesFromEntry(entry: FileSystemEntry): AsyncGenerator<{file: File, path: string}> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
    yield { file, path: entry.name }; // Return relative path for folder drop
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    let entries: FileSystemEntry[] = [];
    let readEntries = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    while(readEntries.length > 0){
        entries = entries.concat(readEntries);
        readEntries = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    }
    
    for (const child of entries) {
      const nestedFiles = getFilesFromEntry(child);
      for await (const nestedFile of nestedFiles) {
          yield { file: nestedFile.file, path: `${entry.name}/${nestedFile.path}` };
      }
    }
  }
}

export default function Home() {
  const [isClient, setIsClient] = useState(false);
  const [appState, setAppState] = useState<AppState>('empty');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [archiveType, setArchiveType] = useState<ArchiveType>('pak');
  const [pakName, setPakName] = useState('new.pak');
  const [isRenamingPak, setIsRenamingPak] = useState(false);
  const [pakEntries, setPakEntries] = useState<PakFileEntry[]>([]);
  const [fileTree, setFileTree] = useState<FileTreeType | null>(null);
  const [selectedFile, setSelectedFile] = useState<PakFileEntry | null>(null);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [deletingType, setDeletingType] = useState<'file' | 'folder' | null>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [saveType, setSaveType] = useState<ArchiveType>('pk3');
  const [clipboard, setClipboard] = useState<ClipboardItem>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [conflictFiles, setConflictFiles] = useState<ConflictFile[]>([]);
  const [replaceAllStrategy, setReplaceAllStrategy] = useState<ReplaceAllStrategy>(null);
  const [pendingFilesToAdd, setPendingFilesToAdd] = useState<PakFileEntry[]>([]);


  const isMobile = useIsMobile();
  const { toast } = useToast();
  const openFileInputRef = useRef<HTMLInputElement>(null);
  const addFileInputRef = useRef<HTMLInputElement>(null);
  const addFolderInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const buildFileTree = useCallback((entries: PakFileEntry[]) => {
    const tree = buildFileTreeUtil(entries);
    setFileTree(tree);
  }, []);

  const updateEntries = useCallback((newEntries: PakFileEntry[], fromLoad: boolean = false) => {
    setPakEntries(newEntries);
    buildFileTree(newEntries);
    if (!fromLoad) {
        setIsDirty(true);
    }
  }, [buildFileTree]);
  
  const handlePakNameChange = (newName: string) => {
      setPakName(newName);
      setIsDirty(true);
  }
  
  const resetStateForNewArchive = useCallback(async (type: ArchiveType = 'pk3'): Promise<void> => {
    return new Promise(resolve => {
        setArchiveType(type);
        const newName = type === 'pak' ? 'new.pak' : 'new.pk3';
        setPakName(newName);
        const initialEntries: PakFileEntry[] = [];
        updateEntries(initialEntries, true);
        setSelectedFile(null);
        setAppState('loaded');
        setIsDirty(false);
        toast({
          title: `New archive created`,
          description: 'You can now add files to the new archive.',
        });
        resolve();
    });
  }, [updateEntries, toast]);

  const handleFileLoad = useCallback(
    async (file: File) => {
      setIsLoadingFile(true);
      setPakName(file.name);
      try {
        const buffer = await file.arrayBuffer();
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        let entries: PakFileEntry[];
        
        if (fileExt === 'pk3' || fileExt === 'zip') {
          entries = await parseZip(buffer);
          setArchiveType('pk3');
          toast({
            title: 'PK3/ZIP file loaded',
            description: `${file.name} successfully parsed with ${entries.length} file(s).`,
          });
        } else {
          entries = await parsePak(buffer);
          setArchiveType('pak');
           toast({
            title: 'PAK file loaded',
            description: `${file.name} successfully parsed with ${entries.length} file(s).`,
          });
        }
        
        updateEntries(entries, true);
        setSelectedFile(null);
        setAppState('loaded');
        setIsDirty(false);
        setPendingAction(null);

      } catch (error) {
        console.error(error);
        toast({
          variant: 'destructive',
          title: 'Error loading archive',
          description: error instanceof Error ? error.message : 'An unknown error occurred.',
        });
      } finally {
        setIsLoadingFile(false);
      }
    },
    [updateEntries, toast]
  );
  
  const handleNewArchive = useCallback((type: ArchiveType = 'pk3') => {
    if (isDirty) {
        setPendingAction({ type: 'new_archive', archiveType: type });
    } else {
        resetStateForNewArchive(type);
    }
  }, [isDirty, resetStateForNewArchive]);

  const handleSave = useCallback(async (type: ArchiveType, options?: SaveOptions) => {
    setIsSaveDialogOpen(false);
    if (pakEntries.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Cannot save',
        description: 'No files to save in the archive.',
      });
      return;
    }
    
    setIsSaving(true);
    try {
      let archiveBuffer: ArrayBuffer;
      const baseName = pakName.replace(/\.(pak|pk3|zip)$/i, '');
      const downloadName = type === 'pak' ? `${baseName}.pak` : `${baseName}.pk3`;
      
      if (type === 'pak') {
        archiveBuffer = await createPak(pakEntries);
      } else {
        archiveBuffer = await createZip(pakEntries, options?.compressionLevel);
      }
      
      const blob = new Blob([archiveBuffer], { type: 'application/octet-stream' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsDirty(false);
      toast({
        title: `${type.toUpperCase()} Saved`,
        description: `${link.download} has been saved successfully.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: `Error saving ${type.toUpperCase()} file`,
        description: error instanceof Error ? error.message : 'An unknown error occurred.',
      });
    } finally {
        setIsSaving(false);
    }
  }, [pakEntries, pakName, toast]);
  
    const addBatchEntries = useCallback((entriesToAdd: PakFileEntry[]) => {
        if (!entriesToAdd || entriesToAdd.length === 0) return;
        setPendingFilesToAdd(entriesToAdd);
    }, []);

    useEffect(() => {
        if (pendingFilesToAdd.length === 0) return;

        const existingPaths = new Map(pakEntries.map(e => [e.path, e]));
        const newFiles: PakFileEntry[] = [];
        const conflicts: ConflictFile[] = [];

        for (const newEntry of pendingFilesToAdd) {
            if (existingPaths.has(newEntry.path)) {
                conflicts.push({ newFile: newEntry, existingFile: existingPaths.get(newEntry.path)! });
            } else {
                newFiles.push(newEntry);
            }
        }
        
        if (conflicts.length > 0) {
            setReplaceAllStrategy(null);
            setConflictFiles(prev => [...prev, ...conflicts]);
        }
        
        if (newFiles.length > 0) {
            updateEntries([...pakEntries, ...newFiles]);
            toast({
                title: `${newFiles.length} file(s) added`,
                description: "New files were added to the archive."
            });
        }
        
        setPendingFilesToAdd([]); // Clear pending files
    }, [pendingFilesToAdd, pakEntries, updateEntries, toast]);


  const handleAddNewFile = useCallback(
    (name: string, data: ArrayBuffer) => {
      const normalizedName = name.replace(/\\/g, '/');
      const newEntry: PakFileEntry = {
        name: normalizedName.split('/').pop() || '',
        path: normalizedName,
        data,
        size: data.byteLength,
        offset: 0, // Offset will be recalculated on save
      };

     addBatchEntries([newEntry]);
    },
    [addBatchEntries]
  );
  
  const handleAddDroppedFile = useCallback(async (file: File, destPath?: string): Promise<PakFileEntry | null> => {
    if (isArchiveFile(file.name)) {
        toast({
            variant: 'destructive',
            title: 'Action blocked',
            description: 'The archive should not contain other archives.'
        });
        return null;
    }
    const path = destPath ? `${destPath}/${file.name}` : file.name;
    const data = await file.arrayBuffer();
    
    return {
        name: path.split('/').pop() || '',
        path: path.replace(/\\/g, '/'),
        data,
        size: data.byteLength,
        offset: 0
    };
  }, [toast]);

  const handleAddDroppedFolder = useCallback(async (entry: FileSystemEntry, destPath?: string): Promise<PakFileEntry[]> => {
      const newEntries: PakFileEntry[] = [];
      
      // Pre-scan for archives
      for await (const {file} of getFilesFromEntry(entry)) {
          if (isArchiveFile(file.name)) {
              toast({
                  variant: 'destructive',
                  title: 'Action blocked',
                  description: 'The archive should not contain other archives.'
              });
              return [];
          }
      }

      for await (const {file, path: relativePath} of getFilesFromEntry(entry)) {
          const newPath = destPath ? `${destPath}/${relativePath}` : relativePath;
          const data = await file.arrayBuffer();
          newEntries.push({
              name: newPath.split('/').pop() || '',
              path: newPath.replace(/\\/g, '/'),
              data,
              size: data.byteLength,
              offset: 0,
          });
      }
      return newEntries;
  }, [toast]);
  
  const handleItemDropOnEmpty = useCallback(async (items: DataTransferItemList) => {
    const entries = Array.from(items).map(item => item.webkitGetAsEntry()).filter(Boolean) as FileSystemEntry[];

    for (const entry of entries) {
      if (entry.isFile) {
        const file = await new Promise<File>(res => (entry as FileSystemFileEntry).file(res));
        if (isArchiveFile(file.name)) {
          toast({ variant: 'destructive', title: 'Action blocked', description: 'The archive should not contain other archives.' });
          return;
        }
      } else if (entry.isDirectory) {
        for await (const { file } of getFilesFromEntry(entry)) {
          if (isArchiveFile(file.name)) {
            toast({ variant: 'destructive', title: 'Action blocked', description: 'The archive should not contain other archives.' });
            return;
          }
        }
      }
    }

    await resetStateForNewArchive('pk3');
    
    let allNewEntries: PakFileEntry[] = [];
    let addedFileCount = 0;
    let addedFolderCount = 0;

    const entryPromises = entries.map(entry => {
        if (entry.isFile) {
            return (async () => {
                const file = await new Promise<File>(res => (entry as FileSystemFileEntry).file(res));
                const data = await file.arrayBuffer();
                addedFileCount++;
                return { name: file.name, path: file.name, data, size: data.byteLength, offset: 0 };
            })();
        } else if (entry.isDirectory) {
            addedFolderCount++;
            return handleAddDroppedFolder(entry, '');
        }
        return Promise.resolve(null);
    });
    
    const results = await Promise.all(entryPromises);
    allNewEntries = results.flat().filter((e): e is PakFileEntry => e !== null);

    addBatchEntries(allNewEntries);

    if (addedFileCount > 0 || addedFolderCount > 0) {
        toast({
            title: 'Items Added',
            description: `Added ${addedFileCount} file(s) and ${addedFolderCount > 0 ? ` content from ${addedFolderCount} folder(s)` : ''} to new archive.`
        });
    }
  }, [resetStateForNewArchive, addBatchEntries, toast, handleAddDroppedFolder]);


  const handleAddNewFolder = useCallback((folderPath: string) => {
      const normalizedPath = folderPath.replace(/\\/g, '/').replace(/\/$/, '');
      if (!normalizedPath) return;

      const placeholderPath = `${normalizedPath}/.placeholder`;

      const existingIndex = pakEntries.findIndex((e) => e.path.startsWith(normalizedPath + '/'));
      if(existingIndex > -1) {
          toast({
              variant: 'destructive',
              title: 'Folder exists',
              description: `A file or folder with the name "${normalizedPath}" already exists.`,
          });
          return;
      }

      // Add a placeholder file to make the folder exist in the PAK structure
      const placeholderEntry: PakFileEntry = {
          name: '.placeholder',
          path: placeholderPath,
          data: new ArrayBuffer(0),
          size: 0,
          offset: 0,
      };

      updateEntries([...pakEntries, placeholderEntry]);

      toast({
          title: 'Folder added',
          description: `Added folder "${normalizedPath}" to the archive.`,
      });

      setIsAddingFolder(false);
  }, [pakEntries, toast, updateEntries]);

  const handleExtractFile = (file: PakFileEntry) => {
    const blob = new Blob([file.data], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMove = useCallback((sourcePath: string, destPath: string) => {
    const isFolder = !pakEntries.some(e => e.path === sourcePath);
    const sourceName = sourcePath.split('/').pop() || '';
    const newBasePath = destPath ? `${destPath}/${sourceName}` : sourceName;

    if (sourcePath === destPath || newBasePath.startsWith(`${sourcePath}/`)) {
        toast({ variant: 'destructive', title: 'Invalid Move', description: 'Cannot move a folder into itself.'});
        return;
    }

    // Check if destination exists
    const destinationExists = pakEntries.some(e => e.path === newBasePath || e.path.startsWith(`${newBasePath}/`));
    if (destinationExists) {
        toast({ variant: 'destructive', title: 'Error', description: `An item named "${sourceName}" already exists in "${destPath || 'root'}".`});
        return;
    }

    let updatedEntries;
    if (isFolder) {
        updatedEntries = pakEntries.map(entry => {
            if (entry.path.startsWith(`${sourcePath}/`)) {
                const newPath = entry.path.replace(sourcePath, newBasePath);
                return { ...entry, path: newPath, name: newPath.split('/').pop() || '' };
            }
            return entry;
        });
    } else {
        updatedEntries = pakEntries.map(entry => {
            if (entry.path === sourcePath) {
                return { ...entry, path: newBasePath, name: sourceName };
            }
            return entry;
        });
    }
    updateEntries(updatedEntries);
    if (selectedFile?.path.startsWith(sourcePath)) {
        setSelectedFile(null);
    }
    toast({ title: 'Moved', description: `Moved "${sourceName}" to "${destPath || 'root'}".` });
  }, [pakEntries, updateEntries, selectedFile, toast]);

  const handleRenameConfirm = useCallback((oldPath: string, newPath: string) => {
    if (oldPath === newPath) {
      setRenamingPath(null);
      return;
    }
    
    const isFolderRename = !pakEntries.some(e => e.path === oldPath);
    let updatedEntries;
    
    if (isFolderRename) {
        updatedEntries = pakEntries.map(entry => {
            if (entry.path.startsWith(`${oldPath}/`)) {
                const remainingPath = entry.path.substring(oldPath.length);
                const updatedPath = `${newPath}${remainingPath}`;
                return { ...entry, path: updatedPath, name: updatedPath.split('/').pop() || '' };
            }
            return entry;
        });
    } else {
         updatedEntries = pakEntries.map(entry => {
            if (entry.path === oldPath) {
                return { ...entry, path: newPath, name: newPath.split('/').pop() || '' };
            }
            return entry;
        });
    }

    updateEntries(updatedEntries);

    if (selectedFile && selectedFile.path.startsWith(oldPath)) {
        const newSelectedPath = selectedFile.path.replace(oldPath, newPath);
        const newSelectedFile = updatedEntries.find(e => e.path === newSelectedPath);
        setSelectedFile(newSelectedFile || null);
    }
    
    setRenamingPath(null);
    toast({ title: "Renamed", description: `"${oldPath}" renamed to "${newPath}"` });
  }, [pakEntries, updateEntries, selectedFile, toast]);

  const handleDelete = useCallback(() => {
    if (!deletingPath) return;

    let updatedEntries;
    if (deletingType === 'file') {
      updatedEntries = pakEntries.filter(entry => entry.path !== deletingPath);
    } else { // folder
      updatedEntries = pakEntries.filter(entry => !entry.path.startsWith(`${deletingPath}/`) && entry.path !== deletingPath);
    }
    
    updateEntries(updatedEntries);

    if (selectedFile && selectedFile.path.startsWith(deletingPath)) {
      setSelectedFile(null);
    }

    toast({ title: "Deleted", description: `Deleted "${deletingPath}"` });
    setDeletingPath(null);
    setDeletingType(null);
  }, [deletingPath, deletingType, pakEntries, updateEntries, selectedFile, toast]);

  const confirmDelete = () => {
    handleDelete();
  };

  const handleSaveClick = (type: ArchiveType) => {
    if (type === 'pak') {
      handleSave('pak');
    } else {
      setSaveType('pk3');
      setIsSaveDialogOpen(true);
    }
  };

  const handleClipboardAction = (type: 'copy' | 'cut', itemType: 'file' | 'folder', path: string) => {
    setClipboard({ type, itemType, path });
    toast({ title: type === 'copy' ? 'Copied' : 'Cut', description: `"${path}" to clipboard.` });
  };

  const handlePaste = useCallback((destPath: string) => {
    if (!clipboard) return;

    const { type, itemType, path: sourcePath } = clipboard;
    const sourceName = sourcePath.split('/').pop() || '';
    const newBasePath = destPath ? `${destPath}/${sourceName}` : sourceName;
    
    if (newBasePath.startsWith(sourcePath + '/')) {
      toast({ variant: 'destructive', title: 'Error', description: 'Cannot paste a folder into itself.' });
      return;
    }
    
    let entriesToAdd: PakFileEntry[] = [];
    let entriesToRemove: string[] = [];

    if (itemType === 'folder') {
      pakEntries.forEach(entry => {
        if (entry.path.startsWith(`${sourcePath}/`)) {
          const newPath = entry.path.replace(sourcePath, newBasePath);
          entriesToAdd.push({ ...entry, path: newPath, name: newPath.split('/').pop() || '' });
          if (type === 'cut') entriesToRemove.push(entry.path);
        }
      });
    } else {
      const sourceFile = pakEntries.find(e => e.path === sourcePath);
      if (sourceFile) {
        entriesToAdd.push({ ...sourceFile, path: newBasePath, name: newBasePath.split('/').pop() || '' });
        if (type === 'cut') entriesToRemove.push(sourcePath);
      }
    }
    
    // Check for conflicts
    const conflict = entriesToAdd.some(add => pakEntries.some(existing => existing.path === add.path));
    if (conflict) {
      toast({ variant: 'destructive', title: 'Error', description: `An item named "${sourceName}" already exists in "${destPath}".` });
      return;
    }
    
    let updatedEntries = [...pakEntries];
    if (type === 'cut') {
      updatedEntries = updatedEntries.filter(e => !entriesToRemove.includes(e.path));
    }
    updatedEntries = [...updatedEntries, ...entriesToAdd];
    
    updateEntries(updatedEntries);
    toast({ title: 'Pasted', description: `Pasted "${sourceName}" into "${destPath}".` });
    if(type === 'cut') setClipboard(null);
  }, [clipboard, pakEntries, toast, updateEntries]);

  const handleAddFileInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const files = Array.from(event.target.files);
      let newEntries: PakFileEntry[] = [];

      // Check for archives before adding
      for (const file of files) {
          if (isArchiveFile(file.name)) {
              toast({
                  variant: 'destructive',
                  title: 'Action blocked',
                  description: 'The archive should not contain other archives.'
              });
              event.target.value = '';
              return;
          }
      }
      
      const entryPromises = files.map(async (file) => {
          const path = file.name;
          const data = await file.arrayBuffer();
          return {
              name: path.split('/').pop() || '',
              path: path,
              data,
              size: data.byteLength,
              offset: 0,
          };
      });
      
      newEntries = await Promise.all(entryPromises);
      addBatchEntries(newEntries);
      // Reset the input value to allow selecting the same file(s) again
      event.target.value = '';
    }
  };

  const handleAddFolderInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
        const files = Array.from(event.target.files);
        let newEntries: PakFileEntry[] = [];

        // Check for archives before adding
        for (const file of files) {
            const path = (file as any).webkitRelativePath || file.name;
            if (isArchiveFile(path)) {
                toast({
                    variant: 'destructive',
                    title: 'Action blocked',
                    description: 'The archive should not contain other archives.'
                });
                event.target.value = '';
                return;
            }
        }
        
        const entryPromises = files.map(async (file) => {
            const path = (file as any).webkitRelativePath || file.name;
            const data = await file.arrayBuffer();
            return {
                name: path.split('/').pop() || '',
                path: path,
                data,
                size: data.byteLength,
                offset: 0,
            };
        });

        newEntries = await Promise.all(entryPromises);
        addBatchEntries(newEntries);
        // Reset the input value to allow selecting the same folder again
        event.target.value = '';
    }
  };
  
  const handleOpenFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
        const file = event.target.files[0];
        if (isDirty) {
          setPendingAction({ type: 'open_file', file });
        } else {
          handleFileLoad(file);
        }
        event.target.value = '';
    }
  };

  const triggerOpenFileInput = () => {
    openFileInputRef.current?.click();
  };

  const handleUnsavedDialogAction = async (action: 'save-pak' | 'save-pk3' | 'dont-save') => {
    if (action === 'save-pak') {
        setPendingAction(null); // Close dialog
        await handleSave('pak');
    } else if (action === 'save-pk3') {
        setPendingAction(null); // Close dialog
        handleSaveClick('pk3');
    } else if (action === 'dont-save') {
        if (pendingAction?.type === 'open_file') {
            handleFileLoad(pendingAction.file);
        } else if (pendingAction?.type === 'new_archive') {
            await resetStateForNewArchive(pendingAction.archiveType);
        }
        setPendingAction(null); // Clear pending action
    }
  };
  
  const handleFileDropOnEmpty = async (file: File) => {
      const isDroppingArchive = isArchiveFile(file.name);
      if (isDroppingArchive) {
        if (isDirty) {
          setPendingAction({ type: 'open_file', file });
        } else {
          handleFileLoad(file);
        }
      } else {
        await resetStateForNewArchive('pk3');
        const data = await file.arrayBuffer();
        handleAddNewFile(file.name, data);
      }
    };

    const processConflictQueue = useCallback(() => {
        if (conflictFiles.length === 0) {
            setReplaceAllStrategy(null); // Clear strategy when queue is done
            return;
        }

        const currentConflict = conflictFiles[0];
        let filesToReplace: PakFileEntry[] = [];
        let filesToKeep: PakFileEntry[] = [...pakEntries];
        let remainingConflicts = [...conflictFiles];

        if (replaceAllStrategy) {
            if (replaceAllStrategy === 'replace') {
                filesToReplace = remainingConflicts.map(c => c.newFile);
            }
            // If 'skip', we just clear the conflicts
            remainingConflicts = [];
        } else {
            // Handled by the dialog interaction, not here
            return;
        }
        
        if (filesToReplace.length > 0) {
            const pathsToReplace = new Set(filesToReplace.map(f => f.path));
            const newPakEntries = [
                ...filesToKeep.filter(f => !pathsToReplace.has(f.path)),
                ...filesToReplace
            ];
            updateEntries(newPakEntries);
            toast({ title: 'Files Replaced', description: `${filesToReplace.length} file(s) have been updated.` });
        }

        setConflictFiles(remainingConflicts);

    }, [conflictFiles, replaceAllStrategy, pakEntries, updateEntries, toast]);

    useEffect(() => {
        // Automatically process the queue if a "replace all" or "skip all" strategy is set
        if (replaceAllStrategy) {
            processConflictQueue();
        }
    }, [replaceAllStrategy, processConflictQueue]);

    const handleConflictResolution = (action: 'replace' | 'skip' | 'replaceAll' | 'skipAll') => {
        if (action === 'replaceAll') {
            setReplaceAllStrategy('replace');
            return; // Effect will handle processing
        }
        if (action === 'skipAll') {
            setReplaceAllStrategy('skip');
            return; // Effect will handle processing
        }

        const [currentConflict, ...remaining] = conflictFiles;
        
        if (action === 'replace') {
            const newPakEntries = [
                ...pakEntries.filter(f => f.path !== currentConflict.newFile.path),
                currentConflict.newFile
            ];
            updateEntries(newPakEntries);
            toast({ title: 'File Replaced', description: `"${currentConflict.newFile.path}" has been updated.` });
        }
        
        // For both 'replace' and 'skip', move to the next conflict
        setConflictFiles(remaining);
    };
    
    // This effect handles continuing the pending action after saving from the dialog.
    useEffect(() => {
        if (!isDirty && pendingAction && !isSaveDialogOpen) {
            if (pendingAction.type === 'open_file') {
                handleFileLoad(pendingAction.file);
            } else if (pendingAction.type === 'new_archive') {
                resetStateForNewArchive(pendingAction.archiveType);
            }
            setPendingAction(null);
        }
    }, [isDirty, pendingAction, handleFileLoad, resetStateForNewArchive, isSaveDialogOpen]);

  
  const fileListPaneProps = {
    pakName,
    isDirty,
    pakEntries,
    fileTree,
    selectedFile,
    renamingPath,
    clipboard,
    isRenamingPak,
    onSelectFile: (file: PakFileEntry) => {
      setSelectedFile(file);
      // Close mobile sidebar when a file is selected so preview is visible
      if (isMobile) setIsMobileMenuOpen(false);
    },
    onRenameStart: setRenamingPath,
    onRenameConfirm: handleRenameConfirm,
    onDeleteStart: (path: string, type: 'file' | 'folder') => { setDeletingPath(path); setDeletingType(type); },
    onMove: handleMove,
    onClipboardAction: handleClipboardAction,
    onPaste: handlePaste,
    onFileDrop: handleAddDroppedFile,
    onFolderDrop: handleAddDroppedFolder,
    onAddFile: () => addFileInputRef.current?.click(),
    onAddFolder: () => addFolderInputRef.current?.click(),
    onNewFolder: () => setIsAddingFolder(true),
    onExtract: handleExtractFile,
    addBatchEntries,
    setIsRenamingPak,
    setPakName: handlePakNameChange,
    toast,
  };

  if (!isClient) {
    return null;
  }
  
  return (
    <div className="flex h-screen w-full flex-col bg-background font-sans">
      <input ref={addFileInputRef} type="file" className="hidden" onChange={handleAddFileInput} multiple />
      <input 
        ref={addFolderInputRef} 
        type="file" 
        className="hidden" 
        onChange={handleAddFolderInput} 
        // @ts-ignore
        webkitdirectory="true" 
        directory="true" 
        multiple
      />
      <input ref={openFileInputRef} type="file" className="hidden" onChange={handleOpenFileInput} accept=".pak,.pk3,.zip" />

      {(isLoadingFile || isSaving) && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <p className="text-lg text-muted-foreground">
                  {isSaving ? 'Saving archive...' : 'Loading archive...'}
                </p>
            </div>
        </div>
      )}

      {isAddingFolder && (
          <AddFolderDialog 
            onClose={() => setIsAddingFolder(false)}
            onConfirm={handleAddNewFolder}
          />
      )}
      {isSaveDialogOpen && (
        <SaveDialog 
            onClose={() => setIsSaveDialogOpen(false)}
            onConfirm={(options) => handleSave(saveType, options)}
            fileName={pakName}
        />
      )}
       {conflictFiles.length > 0 && !replaceAllStrategy && (
          <ReplaceConfirmationDialog 
            conflict={conflictFiles[0]}
            onResolve={handleConflictResolution}
            remainingCount={conflictFiles.length - 1}
          />
      )}
      <AlertDialog open={!!deletingPath} onOpenChange={() => { setDeletingPath(null); setDeletingType(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deletingPath}"{deletingType === 'folder' && ' and all its contents'}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UnsavedChangesDialog 
        isOpen={!!pendingAction && isDirty}
        onAction={handleUnsavedDialogAction}
        onCancel={() => setPendingAction(null)}
      />

      {isMobile && appState === 'loaded' && (
        <MobileSidebar 
          isOpen={isMobileMenuOpen}
          onOpenChange={setIsMobileMenuOpen}
        >
          <FileListPane {...fileListPaneProps} />
        </MobileSidebar>
      )}

      <header className="flex h-16 shrink-0 items-center justify-between border-b px-4 md:px-6">
        <div className="flex items-center gap-3">
          {isMobile && appState === 'loaded' ? (
              <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(true)}>
                  <Menu />
              </Button>
          ) : (
             <Box className="h-7 w-7 text-primary" />
          )}

          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">Pak Explorer</h1>
        </div>
        <div className="flex items-center gap-2">
            {(appState === 'loaded') && (
              <>
                <div className="hidden md:flex items-center gap-2">
                    <Button variant="outline" onClick={triggerOpenFileInput}>
                        <FolderOpen className="mr-2 h-4 w-4" /> Open
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button>
                          Save As...
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleSaveClick('pak')}>
                            <Box className="mr-2 h-4 w-4" /> Save as PAK
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSaveClick('pk3')}>
                             <FileArchive className="mr-2 h-4 w-4" /> Save as PK3
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline" onClick={() => handleNewArchive()}>
                        <PlusCircle className="mr-2 h-4 w-4" /> New Archive
                    </Button>
                </div>
                 <div className="md:hidden">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <MoreVertical />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={triggerOpenFileInput}>
                                <FolderOpen className="mr-2 h-4 w-4" /> Open Archive...
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleNewArchive()}>
                                <PlusCircle className="mr-2 h-4 w-4" /> New Archive
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleSaveClick('pak')}>
                                <Box className="mr-2 h-4 w-4" /> Save as PAK
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSaveClick('pk3')}>
                                <FileArchive className="mr-2 h-4 w-4" /> Save as PK3
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
              </>
            )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {appState === 'empty' ? (
          <div className="flex h-full items-center justify-center p-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <FileDropzone 
                onFileLoad={handleFileLoad} 
                onItemDrop={handleItemDropOnEmpty}
                icon={<UploadCloud size={64} />} 
                accept=".pak,.pk3,.zip"
                message={isMobile ? (
                  <p className="font-semibold text-foreground">Tap to open an archive</p>
                ) : (
                  <p>
                    <span className="font-semibold text-foreground">Drag &amp; drop an archive here to open</span>
                    <br/>
                    <span className="text-sm text-muted-foreground">or drop files/folders to create a new one</span>
                  </p>
                )}
              />
              
              <Button size="lg" onClick={() => handleNewArchive()}>
                <PlusCircle className="mr-2 h-5 w-5" />
                Or Create a New Empty Archive
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col md:flex-row">
            <div className={cn("flex-shrink-0 border-r bg-card/50", 
                isMobile ? "hidden" : "md:w-1/3 md:max-w-sm md:flex")}
            >
                <FileListPane {...fileListPaneProps} />
            </div>

            <section className="flex-1 flex flex-col overflow-y-auto">
              <PreviewPane
                file={selectedFile}
                onExtract={handleExtractFile}
                key={selectedFile?.path}
              />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

    