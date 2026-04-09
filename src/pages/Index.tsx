import { forwardRef } from "react";
import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import PainMirrorSection from "@/components/landing/PainMirrorSection";
import DecisionAuditTrailSection from "@/components/landing/DecisionAuditTrailSection";
import CalibrationProofSection from "@/components/landing/CalibrationProofSection";
import ProductPreview from "@/components/landing/ProductPreview";
import FeaturesSection from "@/components/landing/FeaturesSection";
import IntegrationsSection from "@/components/landing/IntegrationsSection";
import TestimonialSection from "@/components/landing/TestimonialSection";
import SocialProofSection from "@/components/landing/SocialProofSection";
import CTASection from "@/components/landing/CTASection";
import ComparisonSection from "@/components/landing/ComparisonSection";
import Footer from "@/components/landing/Footer";

const Index = forwardRef<HTMLDivElement>((_, ref) => {
  return (
    <div ref={ref} className="min-h-screen bg-background">
      <Navbar />
      <main id="main-content">
        <HeroSection />
        <PainMirrorSection />
        <DecisionAuditTrailSection />
        <CalibrationProofSection />
        <div id="product-preview">
          <ProductPreview />
        </div>
        <FeaturesSection />
        <IntegrationsSection />
        <ComparisonSection />
        <TestimonialSection />
        <SocialProofSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
});

Index.displayName = "Index";

export default Index;
