import * as React from "react";
import { cn } from "@/lib/utils";

export interface ResizableSidebarOptions {
  storageKey?: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidthRatio?: number;
}

export function useResizableSidebar({
  storageKey = "marginalia_ask_sidebar_width",
  defaultWidth = 440,
  minWidth = 360,
  maxWidthRatio = 0.65,
}: ResizableSidebarOptions = {}) {
  const [isDesktop, setIsDesktop] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= 1024;
  });

  const [width, setWidth] = React.useState<number>(() => {
    if (typeof window === "undefined") return defaultWidth;
    try {
      const saved = localStorage.getItem(storageKey);
      const parsed = saved ? parseInt(saved, 10) : defaultWidth;
      return isNaN(parsed) ? defaultWidth : Math.max(minWidth, Math.min(parsed, 1000));
    } catch {
      return defaultWidth;
    }
  });

  const [isDragging, setIsDragging] = React.useState(false);

  React.useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      if (!isDesktop) return;
      e.preventDefault();
      setIsDragging(true);

      const onPointerMove = (moveEvent: PointerEvent) => {
        const maxW = Math.min(950, Math.floor(window.innerWidth * maxWidthRatio));
        const calculated = window.innerWidth - moveEvent.clientX;
        const newWidth = Math.max(minWidth, Math.min(calculated, maxW));
        setWidth(newWidth);
      };

      const onPointerUp = () => {
        setIsDragging(false);
        document.body.style.removeProperty("cursor");
        document.body.style.removeProperty("user-select");
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [isDesktop, minWidth, maxWidthRatio]
  );

  const resetWidth = React.useCallback(() => {
    setWidth(defaultWidth);
    try {
      localStorage.setItem(storageKey, String(defaultWidth));
    } catch {
      // ignore
    }
  }, [defaultWidth, storageKey]);

  const toggleWide = React.useCallback(() => {
    setWidth((prev) => {
      if (prev > 540) {
        return defaultWidth;
      } else {
        return Math.min(720, Math.floor(window.innerWidth * 0.52));
      }
    });
  }, [defaultWidth]);

  React.useEffect(() => {
    if (!isDragging && typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, String(width));
      } catch {
        // ignore
      }
    }
  }, [width, isDragging, storageKey]);

  const isWide = width > 540;

  return {
    width,
    isDesktop,
    isDragging,
    isWide,
    handlePointerDown,
    resetWidth,
    toggleWide,
    asideStyle: isDesktop ? ({ width: `${width}px` } as React.CSSProperties) : undefined,
    mainStyle: isDesktop ? ({ marginRight: `${width}px` } as React.CSSProperties) : undefined,
  };
}

/**
 * Visual drag handle rendered on the left border of the desktop sidebar
 */
export function SidebarResizeHandle({
  onPointerDown,
  onDoubleClick,
  isDragging,
}: {
  onPointerDown: (e: React.PointerEvent) => void;
  onDoubleClick: () => void;
  isDragging: boolean;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      title="Drag to resize split panes · Double-click to reset default width"
      className={cn(
        "hidden lg:flex absolute left-0 inset-y-0 w-3.5 -translate-x-1/2 cursor-col-resize z-50 items-center justify-center group select-none",
        isDragging && "cursor-col-resize"
      )}
    >
      {/* Full-height hairline splitter indicator */}
      <div
        className={cn(
          "absolute inset-y-0 w-[2px] transition-colors duration-150",
          isDragging ? "bg-accent" : "bg-transparent group-hover:bg-accent/40"
        )}
      />
      {/* Centered grip pill */}
      <div
        className={cn(
          "relative z-10 w-1.5 h-9 rounded-full bg-border border border-background transition-all duration-150 flex items-center justify-center shadow-xs",
          "group-hover:bg-accent group-hover:h-12 group-hover:w-2",
          isDragging && "bg-accent h-16 w-2 shadow-md ring-2 ring-accent/30"
        )}
      >
        <div className="w-0.5 h-3.5 bg-background/80 rounded-full" />
      </div>
    </div>
  );
}
