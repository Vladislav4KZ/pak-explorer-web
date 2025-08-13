
'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface MobileSidebarProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  children: React.ReactNode;
}

export function MobileSidebar({ isOpen, onOpenChange, children }: MobileSidebarProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-4/5 max-w-sm p-0">
        <SheetHeader>
            <SheetTitle className="sr-only">File List</SheetTitle>
            <SheetDescription className="sr-only">
                A list of files and folders in the current archive. Select a file to see a preview.
            </SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}
