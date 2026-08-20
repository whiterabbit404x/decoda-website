import { CompanyHero } from '@/components/company/company-hero';
import { WhatDecodaDoes } from '@/components/company/what-decoda-does';
import { WhyThisMatters } from '@/components/company/why-this-matters';
import { RwaSecurityPlatform } from '@/components/company/rwa-security-platform';
import { SecurityLifecycle } from '@/components/company/security-lifecycle';
import { PlatformVision } from '@/components/company/platform-vision';
import { CompanyCta } from '@/components/company/company-cta';

export default function HomePage() {
  return (
    <>
      <CompanyHero />
      <WhatDecodaDoes />
      <WhyThisMatters />
      <RwaSecurityPlatform />
      <SecurityLifecycle />
      <PlatformVision />
      <CompanyCta />
    </>
  );
}
