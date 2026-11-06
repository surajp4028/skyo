"use client";
import { createContext, useContext, useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Aceternity "3D Card Effect". */
const MouseEnterContext = createContext<boolean>(false);

export function CardContainer({ children, className, containerClassName }: { children: ReactNode; className?: string; containerClassName?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const x = (e.clientX - left - width / 2) / 25;
    const y = (e.clientY - top - height / 2) / 25;
    ref.current.style.transform = `rotateY(${x}deg) rotateX(${-y}deg)`;
  };
  return (
    <MouseEnterContext.Provider value={entered}>
      <div className={cn("flex items-center justify-center", containerClassName)} style={{ perspective: "1000px" }}>
        <div
          ref={ref}
          onMouseEnter={() => setEntered(true)}
          onMouseMove={onMove}
          onMouseLeave={() => {
            setEntered(false);
            if (ref.current) ref.current.style.transform = "rotateY(0deg) rotateX(0deg)";
          }}
          className={cn("relative flex items-center justify-center transition-all duration-200 ease-linear", className)}
          style={{ transformStyle: "preserve-3d" }}
        >
          {children}
        </div>
      </div>
    </MouseEnterContext.Provider>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("[transform-style:preserve-3d] [&>*]:[transform-style:preserve-3d]", className)}>{children}</div>;
}

export function CardItem({
  as: Tag = "div",
  children,
  className,
  translateZ = 0,
  rotateZ = 0,
}: {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  translateZ?: number;
  rotateZ?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const entered = useContext(MouseEnterContext);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.transform = entered ? `translateZ(${translateZ}px) rotateZ(${rotateZ}deg)` : "translateZ(0px) rotateZ(0deg)";
  }, [entered, translateZ, rotateZ]);
  return (
    <Tag ref={ref} className={cn("transition duration-200 ease-linear", className)}>
      {children}
    </Tag>
  );
}
