// components/ui/Avatar.tsx
// ============================================================
// Avatar Component
// Displays user profile picture or initials fallback
// ============================================================

import { cn, getInitials } from "@/lib/utils";
import Image from "next/image";

// ============================================================
// Types
// ============================================================
interface AvatarProps {
  src?: string | null;
  alt?: string;
  name?: string;
  fallback?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

// ============================================================
// Size Classes
// ============================================================
const sizeClasses = {
  xs: "h-6 w-6 text-2xs",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
};

// ============================================================
// Avatar Component
// ============================================================
function Avatar({
  src,
  alt,
  name,
  fallback,
  size = "md",
  className,
}: AvatarProps) {
  const initials = fallback || (name ? getInitials(name) : "?");

  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-full bg-primary-100 text-primary-700 font-medium overflow-hidden",
        sizeClasses[size],
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt || name || "Avatar"}
          fill
          className="object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

// ============================================================
// Avatar Group (stacked avatars)
// ============================================================
interface AvatarGroupProps {
  avatars: { src?: string; name: string }[];
  max?: number;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

function AvatarGroup({
  avatars,
  max = 4,
  size = "sm",
  className,
}: AvatarGroupProps) {
  const displayed = avatars.slice(0, max);
  const remaining = avatars.length - max;

  return (
    <div className={cn("flex -space-x-2", className)}>
      {displayed.map((avatar, index) => (
        <Avatar
          key={index}
          src={avatar.src}
          name={avatar.name}
          size={size}
          className="ring-2 ring-white"
        />
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-secondary-200 text-secondary-600 font-medium ring-2 ring-white",
            sizeClasses[size],
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}

export { Avatar, AvatarGroup };
