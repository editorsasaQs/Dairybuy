import type { HTMLAttributes } from "react";

type ContainerProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "header" | "footer" | "nav";
};

export function Container({ as: Tag = "div", className = "", ...props }: ContainerProps) {
  return (
    <Tag
      className={`mx-auto w-full max-w-(--container-max) px-(--gutter) ${className}`}
      {...props}
    />
  );
}
