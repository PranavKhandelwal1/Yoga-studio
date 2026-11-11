"use client";
import { motion, useReducedMotion } from "framer-motion";

/** Smooth, subtle page transition on every navigation. */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return <motion.div initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45, ease: "easeOut" }}>{children}</motion.div>;
}
