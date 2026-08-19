"use client";

import gsap from "gsap";
import { type RefObject, useLayoutEffect } from "react";

export function useRevealMotion(
  scope: RefObject<HTMLElement | null>,
  dependency: string,
) {
  useLayoutEffect(() => {
    const root = scope.current;
    if (!root) return;

    gsap.ticker.lagSmoothing(0);
    gsap.ticker.wake();
    root.classList.add("isRevealing");

    const context = gsap.context(() => {
      gsap.to(".revealItem", {
        opacity: 1,
        y: 0,
        duration: 0.7,
        stagger: 0.08,
        ease: "power3.out",
        overwrite: true,
      });
    }, scope);

    return () => {
      context.revert();
      root.classList.remove("isRevealing");
    };
  }, [dependency, scope]);
}
