"use client";
import { motion, useReducedMotion } from "framer-motion";

/** A single, quiet fade as content enters. Respects prefers-reduced-motion. */
export function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0 }} whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-40px" }} transition={{ duration: 1, delay, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}
