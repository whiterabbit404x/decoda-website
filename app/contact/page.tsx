import Link from 'next/link';
import { PageHero, SectionIntro } from '@/components/sections';
import { ContactForm } from '@/components/company/contact-form';

export default function ContactPage() {
  return (
    <div className="content-stack">
      <PageHero
        eyebrow="Contact Decoda"
        title="Request a demo, security briefing, or strategy conversation."
        body="This is the direct line for prospective customers, partners, and stakeholders evaluating Decoda and RWA Security."
        actions={
          <a
            className="button-primary"
            href="mailto:hello@decodasecurity.com?subject=Decoda%20Security%20Inquiry"
          >
            Email Decoda
          </a>
        }
        aside={
          <div className="hero-panel">
            <p className="eyebrow">Suggested next steps</p>
            <ul className="compact-list">
              <li>Request RWA Security walkthrough</li>
              <li>Discuss deployment priorities</li>
              <li>Share partnership or press inquiries</li>
            </ul>
          </div>
        }
      />

      <section className="section-grid contact-grid">
        <div>
          <SectionIntro
            eyebrow="Get in touch"
            title="Tell us what you're evaluating and we'll route it to the right team."
            description="Share a few details about your program and the Decoda team will follow up using the work email you provide."
          />
          <div className="contact-details">
            <div>
              <p className="eyebrow">Primary inbox</p>
              <a href="mailto:hello@decodasecurity.com">hello@decodasecurity.com</a>
            </div>
            <div>
              <p className="eyebrow">What this inbox handles</p>
              <p>Sales demos, strategic partnerships, media requests, and investor conversations.</p>
            </div>
            <div>
              <p className="eyebrow">Flagship product</p>
              <Link href="/solutions/rwa-security">Explore RWA Security</Link>
            </div>
          </div>
        </div>

        <ContactForm />
      </section>
    </div>
  );
}
