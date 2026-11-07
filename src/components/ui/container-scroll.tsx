"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "motion/react";

/** Aceternity "Container Scroll Animation" — a device that tilts flat as it scrolls into view. */
export function ContainerScroll({ title, children }: { title: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref });
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth <= 768);
    const raf = requestAnimationFrame(check);
    window.addEventListener("resize", check);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", check);
    };
  }, []);
  const rotate = useTransform(scrollYProgress, [0, 1], [20, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], mobile ? [0.7, 0.9] : [1.05, 1]);
  const translate = useTransform(scrollYProgress, [0, 1], [0, -100]);
  return (
    <div ref={ref} className="relative flex h-[46rem] items-center justify-center p-2 md:h-[60rem] md:p-12">
      <div className="relative w-full py-8 md:py-16" style={{ perspective: "1000px" }}>
        <motion.div style={{ translateY: translate }} className="mx-auto max-w-5xl text-center">{title}</motion.div>
        <motion.div
          style={{ rotateX: rotate, scale, boxShadow: "0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003" }}
          className="mx-auto -mt-10 h-[30rem] w-full max-w-5xl rounded-[30px] border-4 border-[#6C6C6C] bg-[#222222] p-2 md:h-[38rem] md:p-5"
        >
          <div className="h-full w-full overflow-hidden rounded-2xl bg-surface">{children}</div>
        </motion.div>
      </div>
    </div>
  );
}
