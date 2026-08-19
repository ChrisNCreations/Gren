"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type RefObject, useLayoutEffect } from "react";

function setStoryScene(root: HTMLElement, index: number) {
  root.querySelectorAll<HTMLElement>("[data-story-scene]").forEach((element) => {
    element.classList.toggle("isActive", Number(element.dataset.storyScene) === index);
  });
  root.querySelectorAll<HTMLElement>("[data-stage-panel]").forEach((element) => {
    element.classList.toggle("isActive", Number(element.dataset.stagePanel) === index);
  });
  root.querySelectorAll(".landingStoryProgress i").forEach((element, itemIndex) => {
    element.classList.toggle("isActive", itemIndex === index);
  });
}

function storyProgress(story: HTMLElement) {
  const range = story.offsetHeight - window.innerHeight;
  if (range <= 0) return 0;
  return Math.min(1, Math.max(0, -story.getBoundingClientRect().top / range));
}

export function useLandingMotion(scope: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const root = scope.current;
    if (!root) return;

    const story = root.querySelector<HTMLElement>(".landingStory");
    const architecture = root.querySelector<HTMLElement>(".landingArchitecture");
    const header = root.querySelector(".landingHeader");

    const onScroll = () => {
      if (story) {
        const progress = storyProgress(story);
        setStoryScene(root, progress < 1 / 3 ? 0 : progress < 2 / 3 ? 1 : 2);
      }
      if (header && architecture) {
        const rect = architecture.getBoundingClientRect();
        const inBand = rect.top < window.innerHeight * 0.65 && rect.bottom > window.innerHeight * 0.35;
        header.classList.toggle("isDark", inBand);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    gsap.registerPlugin(ScrollTrigger);
    gsap.ticker.lagSmoothing(0);
    gsap.ticker.wake();
    root.classList.add("hasMotion");

    const context = gsap.context(() => {
      gsap.to(".landingHeroContent", {
        opacity: 1,
        y: 0,
        duration: 1.15,
        delay: 0.12,
        ease: "power3.out",
        overwrite: true,
      });

      gsap.to(".landingArtifact", {
        opacity: 1,
        scale: 1,
        duration: 1,
        stagger: 0.1,
        delay: 0.25,
        ease: "power3.out",
        overwrite: true,
      });

      gsap.utils.toArray<HTMLElement>(".landingReveal").forEach((element, index) => {
        gsap.to(element, {
          opacity: 1,
          y: 0,
          duration: 0.9,
          delay: (index % 3) * 0.08,
          ease: "power3.out",
          overwrite: true,
          scrollTrigger: { trigger: element, start: "top 88%", once: true },
        });
      });

      root.querySelectorAll<HTMLElement>("[data-parallax]").forEach((artifact) => {
        gsap.to(artifact, {
          y: Number(artifact.dataset.parallax),
          ease: "none",
          overwrite: "auto",
          scrollTrigger: {
            trigger: ".landingHero",
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });
      });

      gsap.fromTo(
        ".landingFlowLine",
        { strokeDashoffset: 220 },
        {
          strokeDashoffset: 0,
          stagger: 0.2,
          duration: 1.8,
          ease: "none",
          scrollTrigger: {
            trigger: ".landingArchitectureDiagram",
            start: "top 80%",
            end: "bottom 50%",
            scrub: true,
          },
        },
      );
    }, root);

    const refresh = window.requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      gsap.ticker.wake();
    });

    return () => {
      window.cancelAnimationFrame(refresh);
      window.removeEventListener("scroll", onScroll);
      context.revert();
      root.classList.remove("hasMotion");
    };
  }, [scope]);
}
