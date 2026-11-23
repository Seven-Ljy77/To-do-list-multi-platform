import type { ReactNode } from "react";

interface SvgProps {
  size?: number;
  className?: string;
  children: ReactNode;
}

function Svg({ size = 18, className, children }: SvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function CheckIcon({ size, className }: { size?: number; className?: string }) {
  return (
    <Svg size={size} className={className}>
      <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
    </Svg>
  );
}

export function PlusIcon({ size, className }: { size?: number; className?: string }) {
  return (
    <Svg size={size} className={className}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function GripIcon({ size, className }: { size?: number; className?: string }) {
  return (
    <Svg size={size} className={className}>
      <circle cx="9" cy="6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1.1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function PencilIcon({ size, className }: { size?: number; className?: string }) {
  return (
    <Svg size={size} className={className}>
      <path d="M4 20h4L18.5 9.5a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </Svg>
  );
}

export function TrashIcon({ size, className }: { size?: number; className?: string }) {
  return (
    <Svg size={size} className={className}>
      <path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13M10 11v6M14 11v6" />
    </Svg>
  );
}

export function XIcon({ size, className }: { size?: number; className?: string }) {
  return (
    <Svg size={size} className={className}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Svg>
  );
}

export function LogOutIcon({ size, className }: { size?: number; className?: string }) {
  return (
    <Svg size={size} className={className}>
      <path d="M9 4H5v16h4M15 8l4 4-4 4M19 12H9" />
    </Svg>
  );
}

export function SettingsIcon({ size, className }: { size?: number; className?: string }) {
  return (
    <Svg size={size} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </Svg>
  );
}

export function CalendarIcon({ size, className }: { size?: number; className?: string }) {
  return (
    <Svg size={size} className={className}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </Svg>
  );
}

export function TagIcon({ size, className }: { size?: number; className?: string }) {
  return (
    <Svg size={size} className={className}>
      <path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9Z" />
      <circle cx="8" cy="8" r="1.2" />
    </Svg>
  );
}

export function ChevronIcon({ size, className }: { size?: number; className?: string }) {
  return (
    <Svg size={size} className={className}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function InboxIcon({ size, className }: { size?: number; className?: string }) {
  return (
    <Svg size={size} className={className}>
      <path d="M4 5h16v14H4z" />
      <path d="M4 13h5l1.5 3h3L15 13h5" />
    </Svg>
  );
}

export function LayersIcon({ size, className }: { size?: number; className?: string }) {
  return (
    <Svg size={size} className={className}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </Svg>
  );
}

export function LockIcon({ size, className }: { size?: number; className?: string }) {
  return (
    <Svg size={size} className={className}>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}
