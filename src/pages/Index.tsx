import { forwardRef } from "react";
import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import ProductPreview from "@/components/landing/ProductPreview";
import FeaturesSection from "@/components/landing/FeaturesSection";
import ComparisonSection from "@/components/landing/ComparisonSection";
import SocialProofSection from "@/components/landing/SocialProofSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

/**
 * Landing page — simplified to 6 sections max (InVideo pattern).
 * Previous 12-section layout caused cognitive overload and blank mobile renders.
 *
 * Flow: Hero → Product → Features → Comparison → Social Proof → CTA
 */
const Index = forwardRef<HTMLDivElement>((_, ref) => {
  return (
    <div ref={ref} className="min-h-dvh bg-background flex flex-col">
      <Navbar />
      <main id="main-content">
        <HeroSection />
        <div id="product-preview">
          <ProductPreview />
        </div>
        <FeaturesSection />
        <ComparisonSection />
        <SocialProofSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
});

Index.displayName = "Index";

export default Index;
