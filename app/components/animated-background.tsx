import * as React from "react";
import { motion } from "framer-motion";

export function AnimatedBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden select-none"
    >
      {/* Subtle Dot Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: "radial-gradient(#262626 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Floating Ambient Aura Orbs */}
      <motion.div
        animate={{
          x: [0, 40, -30, 0],
          y: [0, -50, 20, 0],
          scale: [1, 1.15, 0.9, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-[#ff5e1f]/10 blur-3xl"
      />

      <motion.div
        animate={{
          x: [0, -50, 40, 0],
          y: [0, 40, -30, 0],
          scale: [1, 0.9, 1.2, 1],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
        className="absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-[#ff9966]/10 blur-3xl"
      />

      <motion.div
        animate={{
          x: [0, 30, -40, 0],
          y: [0, -30, 40, 0],
          scale: [1, 1.2, 0.95, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 4,
        }}
        className="absolute bottom-10 left-1/3 h-80 w-80 rounded-full bg-[#ffefe8] blur-3xl opacity-70"
      />
    </div>
  );
}
