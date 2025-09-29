import Link from "next/link";
import React from "react";

type QuickActionButtonProps = {
  icon: React.ReactNode;
  title: string;
  href?: string;
  color?: string;
  onClick?: () => void; // Add this line
  disabled?: boolean; // Optional: for upload state
};

export default function QuickActionButton({
  icon,
  title,
  href,
  color = "",
  onClick,
  disabled = false,
}: QuickActionButtonProps) {
  if (onClick) {
    return (
      <button
        className={`flex items-center justify-center px-4 py-4 border border-transparent rounded-xl shadow-sm text-sm font-medium ${color} transition-all transform hover:scale-105`}
        onClick={onClick}
        disabled={disabled}
        type="button"
      >
        {icon}
        {title}
      </button>
    );
  }
  return (
    <a
      href={href}
      className={`flex items-center justify-center px-4 py-4 border border-transparent rounded-xl shadow-sm text-sm font-medium ${color} transition-all transform hover:scale-105`}
    >
      {icon}
      {title}
    </a>
  );
}
