// components/ui/Tabs.tsx
'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within <Tabs>.');
  }

  return context;
}

type TabsProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  className,
  children,
  ...props
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const currentValue = value ?? internalValue;

  const contextValue = useMemo(
    () => ({
      value: currentValue,
      setValue: (nextValue: string) => {
        if (value === undefined) {
          setInternalValue(nextValue);
        }
        onValueChange?.(nextValue);
      },
    }),
    [currentValue, onValueChange, value],
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={cn('space-y-4', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'inline-flex h-auto flex-wrap items-center gap-2 rounded-lg bg-gray-100 p-1',
        className,
      )}
      role="tablist"
      {...props}
    />
  );
}

type TabsTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string;
  href?: string;
};

export function TabsTrigger({
  value,
  className,
  children,
  onClick,
  ...props
}: TabsTriggerProps) {
  const tabs = useTabsContext();
  const isActive = tabs.value === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      data-state={isActive ? 'active' : 'inactive'}
      className={cn(
        'inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900',
        className,
      )}
      onClick={(event) => {
        tabs.setValue(value);
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

type TabsContentProps = React.HTMLAttributes<HTMLDivElement> & {
  value: string;
  active?: boolean;
};

export function TabsContent({
  value,
  active,
  className,
  children,
  ...props
}: TabsContentProps) {
  const tabs = useTabsContext();
  const isVisible = active ?? tabs.value === value;

  if (!isVisible) {
    return null;
  }

  return (
    <div role="tabpanel" data-state="active" className={className} {...props}>
      {children}
    </div>
  );
}

export const TabTrigger = TabsTrigger;
export const TabContent = TabsContent;
