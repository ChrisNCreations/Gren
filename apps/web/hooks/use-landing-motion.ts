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

export function useLandingMotion(scope: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const root = scope.current;
    if (!root) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.classList.remove("hasMotion");
      return;
    }

    gsap.registerPlugin(ScrollTrigger);
    root.classList.add("hasMotion");

    const story = root.querySelector<HTMLElement>(".landingStory");
    const updateStory = () => {
      if (!story) return;
      const range = story.offsetHeight - window.innerHeight;
      const progress = range <= 0 ? 0 : Math.min(1, Math.max(0, -story.getBoundingClientRect().top / range));
      setStoryScene(root, progress < 1 / 3 ? 0 : progress < 2 / 3 ? 1 : 2);
    };
    if (story) {
      window.addEventListener("scroll", updateStory, { passive: true });
      updateStory();
    }

    const context = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".landingReveal").forEach((element, index) => {
        gsap.to(element, {
          opacity: 1,
          y: 0,
          duration: 0.9,
          delay: (index % 3) * 0.08,
          ease: "power3.out",
          scrollTrigger: { trigger: element, start: "top 88%", once: true },
        });
      });

      gsap.fromTo(
        ".landingHeroContent",
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 1.15, ease: "power3.out", delay: 0.12 },
      );

      gsap.fromTo(
        ".landingArtifact",
        { opacity: 0, scale: 0.82 },
        { opacity: 1, scale: 1, duration: 1, stagger: 0.1, ease: "power3.out", delay: 0.25 },
      );

      root.querySelectorAll<HTMLElement>("[data-parallax]").forEach((artifact) => {
        gsap.to(artifact, {
          y: Number(artifact.dataset.parallax),
          ease: "none",
          scrollTrigger: {
            trigger: ".landingHero",
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });
      });

      const header = root.querySelector(".landingHeader");
      ScrollTrigger.create({
        trigger: ".landingArchitecture",
        start: "top 65%",
        end: "bottom 35%",
        onEnter: () => header?.classList.add("isDark"),
        onLeaveBack: () => header?.classList.remove("isDark"),
        onLeave: () => header?.classList.remove("isDark"),
        onEnterBack: () => header?.classList.add("isDark"),
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
    });

    return () => {
      window.cancelAnimationFrame(refresh);
      window.removeEventListener("scroll", updateStory);
      context.revert();
      root.classList.remove("hasMotion");
    };
  }, [scope]);
}
