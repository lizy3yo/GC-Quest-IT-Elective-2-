"use client";

import React from "react";
import Link from "next/link";

type CommonProps = {
  className?: string;
  children: React.ReactNode;
  title?: string;
};

type ButtonAsButton = CommonProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    as?: "button";
    href?: never;
  };

type ButtonAsLink = CommonProps & {
  as: "link";
  href: string;
  target?: string;
  rel?: string;
};

type Props = ButtonAsButton | ButtonAsLink;

const baseClasses =
  "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2e7d32]";

/**
 * Primary action button
 * - Light + Dark: solid #2e7d32 background, white text
 */
export function PrimaryActionButton(props: Props) {
  const { className, children, title } = props as CommonProps;
  const classes = [
    baseClasses,
    // Light mode solid green with white text
    "bg-[#2e7d32] text-white hover:opacity-90",
    // Dark mode: same color as light mode
    "dark:bg-[#2e7d32] dark:text-white",
    // Disabled state styling for buttons
    "disabled:opacity-50 disabled:cursor-not-allowed",
  ]
    .concat(className ? [className] : [])
    .join(" ");

  if ((props as ButtonAsLink).as === "link") {
    const { href, target, rel } = props as ButtonAsLink;
    return (
      <Link href={href} target={target} rel={rel} className={classes} title={title}>
        {children}
      </Link>
    );
  }

  const btnProps = props as ButtonAsButton;
  return (
    <button {...btnProps} className={classes} title={title}>
      {children}
    </button>
  );
}

export default PrimaryActionButton;
