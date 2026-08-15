"use client";

import gsap from "gsap";
import { type RefObject, useLayoutEffect } from "react";

export function useRevealMotion(
  scope: RefObject<HTMLElement | null>,
  dependency: string,
) {
  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const context = gsap.context(() => {
      gsap.fromTo(
        ".revealItem",
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.7, stagger: 0.08, ease: "power3.out" },
      );
    }, scope);

    return () => context.revert();
  }, [dependency, scope]);
}
