"use client";

import { useRef } from "react";
import { LandingArchitecture } from "@/components/landing/landing-architecture";
import { LandingCta } from "@/components/landing/landing-cta";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingPrinciples } from "@/components/landing/landing-principles";
import { LandingProof } from "@/components/landing/landing-proof";
import { LandingStory } from "@/components/landing/landing-story";
import { useLandingMotion } from "@/hooks/use-landing-motion";
import "./landing.css";

export default function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  useLandingMotion(rootRef);

  return (
    <div className="landing" ref={rootRef}>
      <LandingHeader />
      <main>
        <LandingHero />
        <LandingPrinciples />
        <LandingStory />
        <LandingArchitecture />
        <LandingProof />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
