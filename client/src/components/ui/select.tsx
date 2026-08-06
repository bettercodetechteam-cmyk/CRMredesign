"use client"

import React, { forwardRef, type ElementRef, type ComponentPropsWithoutRef } from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"

// Select Root component
type SelectOpenContextValue = {
  lastOpenTimestampRef: React.MutableRefObject<number>;
};

const SelectOpenContext = React.createContext<SelectOpenContextValue | null>(null);

const Select: React.FC<React.ComponentProps<typeof SelectPrimitive.Root>> = ({ onOpenChange, ...props }) => {
  const lastOpenTimestampRef = React.useRef(0);

  return (
    <SelectOpenContext.Provider value={{ lastOpenTimestampRef }}>
      <SelectPrimitive.Root
        {...props}
        onOpenChange={(open) => {
          if (open) {
            lastOpenTimestampRef.current = Date.now();
            document.body.classList.add('select-open');
          } else {
            document.body.classList.remove('select-open');
          }
          onOpenChange?.(open);
        }}
      />
    </SelectOpenContext.Provider>
  );
}
Select.displayName = "Select";

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = forwardRef<
  ElementRef<typeof SelectPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      data-radix-select-trigger="true"
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        className
      )}
      style={{
        pointerEvents: 'auto',
        cursor: 'pointer',
        ...props.style
      }}
      onPointerDown={(e) => {
        props.onPointerDown?.(e);
      }}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
})
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = forwardRef<
  ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = forwardRef<
  ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName

const isEventFromSelectTrigger = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(
    target.closest('[data-radix-select-trigger]') ||
    target.closest('button[role="combobox"]')
  );
};

const SelectContent = forwardRef<ElementRef<typeof SelectPrimitive.Content>, ComponentPropsWithoutRef<typeof SelectPrimitive.Content>>(({ className, children, position = "popper", ...props }, ref) => {
  const selectContext = React.useContext(SelectOpenContext);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Aggressively force remove blur using MutationObserver
  React.useEffect(() => {
    if (!contentRef.current) return;

    const element = contentRef.current;
    
    const forceRemoveBlur = () => {
      if (!element) return;
      
      element.style.setProperty('filter', 'none', 'important');
      element.style.setProperty('-webkit-filter', 'none', 'important');
      element.style.setProperty('backdrop-filter', 'none', 'important');
      element.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
      element.style.setProperty('opacity', '1', 'important');
      
      // Apply to all children recursively
      const applyToAll = (el: Element) => {
        Array.from(el.children).forEach((child) => {
          if (child instanceof HTMLElement) {
            child.style.setProperty('filter', 'none', 'important');
            child.style.setProperty('-webkit-filter', 'none', 'important');
            child.style.setProperty('backdrop-filter', 'none', 'important');
            child.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
            child.style.setProperty('opacity', '1', 'important');
            applyToAll(child);
          }
        });
      };
      applyToAll(element);
    };

    // Initial force
    forceRemoveBlur();

    // Watch for any style changes and immediately revert them
    const observer = new MutationObserver(() => {
      forceRemoveBlur();
    });

    observer.observe(element, {
      attributes: true,
      attributeFilter: ['style', 'class'],
      childList: true,
      subtree: true
    });

    // Also use RAF to continuously check
    let rafId: number;
    const checkLoop = () => {
      forceRemoveBlur();
      rafId = requestAnimationFrame(checkLoop);
    };
    rafId = requestAnimationFrame(checkLoop);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={(node) => {
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.MutableRefObject<React.ElementRef<typeof SelectPrimitive.Content> | null>).current = node;
          contentRef.current = node;
        }}
        data-radix-select-content="true"
        data-no-blur="true"
        className={cn(
          "select-dropdown-content relative z-[99999] max-h-[--radix-select-content-available-height] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-white dark:bg-slate-950 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-select-content-transform-origin]",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className
        )}
        style={{
          filter: 'none !important',
          WebkitFilter: 'none !important',
          backdropFilter: 'none !important',
          WebkitBackdropFilter: 'none !important',
          pointerEvents: 'auto',
          zIndex: 100000,
          backgroundColor: 'white',
          opacity: 1,
          ...props.style
        }}
        position={position}
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onPointerDownOutside={(e) => {
          const originalEventTarget = e.detail?.originalEvent?.target ?? null;
          const targetIsTrigger =
            isEventFromSelectTrigger(e.target) || isEventFromSelectTrigger(originalEventTarget);

          const lastOpenedAt = selectContext?.lastOpenTimestampRef.current ?? 0;
          const timeSinceOpen = Date.now() - lastOpenedAt;

          if (targetIsTrigger || timeSinceOpen < 200) {
            e.preventDefault();
            e.stopPropagation();
            if (e.detail?.originalEvent) {
              e.detail.originalEvent.preventDefault?.();
              e.detail.originalEvent.stopPropagation?.();
            }
            return;
          }

          props.onPointerDownOutside?.(e);
        }}
        onEscapeKeyDown={(e) => {
          props.onEscapeKeyDown?.(e);
        }}
        {...props}
      >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
        style={{
          filter: 'none !important',
          WebkitFilter: 'none !important',
          backdropFilter: 'none !important',
          WebkitBackdropFilter: 'none !important',
          opacity: 1
        }}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
  );
});
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = forwardRef<
  ElementRef<typeof SelectPrimitive.Label>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = forwardRef<
  ElementRef<typeof SelectPrimitive.Item>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    style={{
      filter: 'none !important',
      WebkitFilter: 'none !important',
      backdropFilter: 'none !important',
      WebkitBackdropFilter: 'none !important',
      opacity: 1,
      backgroundColor: '#ffffff',
      color: '#000000',
      ...props.style
    }}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = forwardRef<
  ElementRef<typeof SelectPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
