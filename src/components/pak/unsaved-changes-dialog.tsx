
'use client';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  onAction: (action: 'save-pak' | 'save-pk3' | 'dont-save') => void;
  onCancel: () => void;
}

export function UnsavedChangesDialog({ isOpen, onAction, onCancel }: UnsavedChangesDialogProps) {
  if (!isOpen) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>You have unsaved changes</AlertDialogTitle>
          <AlertDialogDescription>
            Do you want to save your changes before continuing? If you don't save,
            your changes will be lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
           <div className='flex w-full flex-col-reverse sm:flex-row sm:justify-end gap-2'>
            <Button variant="outline" onClick={onCancel} className="sm:w-auto w-full">
                Cancel
            </Button>
            <Button variant="destructive" onClick={() => onAction('dont-save')} className="sm:w-auto w-full">
                Don't Save
            </Button>
            <Button onClick={() => onAction('save-pk3')} className="sm:w-auto w-full">Save as PK3</Button>
            <Button onClick={() => onAction('save-pak')} className="sm:w-auto w-full">Save as PAK</Button>
           </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
