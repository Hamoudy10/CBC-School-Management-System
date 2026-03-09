// components/ui/Skeletons.tsx
import React from 'react';

export function Skeleton(props: any) {
  return <div className="animate-pulse bg-gray-200 rounded" {...props} />;
}

export function SkeletonProfile(props: any) {
  return <Skeleton {...props} className="h-24 w-24 rounded-full" />;
}

export function SkeletonLine(props: any) {
  return <Skeleton {...props} className="h-4 w-full" />;
}

export function CardSkeleton(props: any) {
  return <Skeleton {...props} className="h-32 w-full" />;
}

export function TableSkeleton(props: any) {
  return <Skeleton {...props} className="h-80 w-full rounded-lg" />;
}
