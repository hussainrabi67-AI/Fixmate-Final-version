import Hero from '../components/Hero'
import ServiceCategories from '../components/ServiceCategories'
import VerifiedTechniciansSection from '../components/VerifiedTechniciansSection'
import AISection from '../components/AISection'
import HowItWorks from '../components/HowItWorks'
import TechnicianSection from '../components/TechnicianSection'
import TrustSection from '../components/TrustSection'

export default function LandingPage() {
  return (
    <>
      <Hero />
      <ServiceCategories />
      <VerifiedTechniciansSection />
      <AISection />
      <HowItWorks />
      <TechnicianSection />
      <TrustSection />
    </>
  )
}
