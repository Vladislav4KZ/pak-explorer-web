
'use client';

import { useSwipeable } from 'react-swipeable';
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
  const handlers = useSwipeable({
    onSwipedLeft: () => onOpenChange(false),
    trackMouse: true,
  });

  const openHandlers = useSwipeable({
    onSwipedRight: () => onOpenChange(true),
    trackMouse: true,
  });

  return (
    <>
      {/* Invisible swipe area on the left edge of the screen to open the menu */}
      {!isOpen && (
        <div
          {...openHandlers}
          className="fixed inset-y-0 left-0 z-50 w-8 bg-transparent"
        />
      )}
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-4/5 max-w-sm p-0" hideCloseButton>
            <div {...handlers} className="h-full">
                <SheetHeader>
                    <SheetTitle className="sr-only">File List</SheetTitle>
                    <SheetDescription className="sr-only">
                        A list of files and folders in the current archive. Select a file to see a preview.
                    </SheetDescription>
                </SheetHeader>
                {children}
            </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
