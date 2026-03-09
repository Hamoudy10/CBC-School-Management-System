import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

type EmptyStateAction =
  | ReactNode
  | {
      label: string;
      onClick?: () => void;
      href?: string;
    };

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: EmptyStateAction;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  const renderedAction =
    action && typeof action === "object" && "label" in action ? (
      action.href ? (
        <Link href={action.href}>
          <Button type="button">{action.label}</Button>
        </Link>
      ) : (
        <Button type="button" onClick={action.onClick}>
          {action.label}
        </Button>
      )
    ) : (
      action
    );

  return (
    <div
      className={[
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 px-6 py-12 text-center",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon ? <div className="mb-4 text-gray-400">{icon}</div> : null}
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-gray-500">{description}</p>
      ) : null}
      {renderedAction ? <div className="mt-6">{renderedAction}</div> : null}
    </div>
  );
}
