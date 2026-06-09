"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AnimatedContainerProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  type?: "fade" | "slideUp" | "scale" | "slideDown";
}

const variants = {
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 } },
  slideUp: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
  },
  slideDown: {
    initial: { opacity: 0, y: -12 },
    animate: { opacity: 1, y: 0 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
  },
};

const AnimatedContainer = forwardRef<HTMLDivElement, AnimatedContainerProps>(
  ({ children, type = "fade", className, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={cn(className)}
      variants={variants[type]}
      initial="initial"
      animate="animate"
      transition={{ duration: 0.3, ease: "easeOut" }}
      {...props}
    >
      {children}
    </motion.div>
  ),
);
AnimatedContainer.displayName = "AnimatedContainer";

interface StaggerListProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

function StaggerList({ children, className, staggerDelay = 0.05 }: StaggerListProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: staggerDelay } },
      }}
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
}

function StaggerItem({ children, className }: StaggerItemProps) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export { AnimatedContainer, StaggerList, StaggerItem };
