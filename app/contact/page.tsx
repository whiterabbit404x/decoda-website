import Link from 'next/link';
import { PageHero, SectionIntro } from '@/components/sections';

export default function ContactPage() {
  return (
    <div className="content-stack">
      <PageHero
        eyebrow="Contact Decoda"
        title="Request a demo, security briefing, or strategy conversation."
        body="Use this public-facing contact route for prospective customers, partners, and stakeholders evaluating Decoda and Product A."
        actions={
          <a className="button-primary" href="mailto:hello@decoda.example?subject=Request%20for%20Decoda%20demo">
            Email Decoda
          </a>
        }
        aside={
          <div className="hero-panel">
            <p className="eyebrow">Suggested next steps</p>
            <ul className="compact-list">
              <li>Request Product A walkthrough</li>
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
            title="A clean public contact experience for an institutional audience."
            description="This form is intentionally simple and positioned for demo requests. Wire it to your CRM, scheduling tool, or secure intake workflow when ready."
          />
          <div className="contact-details">
            <div>
              <p className="eyebrow">Primary inbox</p>
              <a href="mailto:hello@decoda.example">hello@decoda.example</a>
            </div>
            <div>
              <p className="eyebrow">Suggested routing</p>
              <p>Sales demos, strategic partnerships, media requests, and investor conversations.</p>
            </div>
            <div>
              <p className="eyebrow">Flagship product</p>
              <Link href="/solutions/rwa-security">Explore Product A: RWA Security</Link>
            </div>
          </div>
        </div>

        <form className="contact-form">
          <label>
            Name
            <input type="text" placeholder="Jane Smith" />
          </label>
          <label>
            Work email
            <input type="email" placeholder="jane@institution.com" />
          </label>
          <label>
            Company
            <input type="text" placeholder="Institution name" />
          </label>
          <label>
            Interest area
            <select defaultValue="">
              <option value="" disabled>
                Select one
              </option>
              <option>Product A demo</option>
              <option>Platform roadmap discussion</option>
              <option>Partnership inquiry</option>
              <option>Media or investor request</option>
            </select>
          </label>
          <label>
            What are you evaluating?
            <textarea
              rows={6}
              placeholder="Share the use case, timelines, or security questions Decoda should prepare for."
            />
          </label>
          <button type="submit" className="button-primary">
            Request follow-up
          </button>
          <p className="form-note">
            Placeholder form only. Connect submission handling to your preferred CRM or secure
            intake workflow.
          </p>
        </form>
      </section>
    </div>
  );
}
