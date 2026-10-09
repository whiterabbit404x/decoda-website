import type { ReactNode } from 'react';
import { AmbientBackdrop } from './ui';
import styles from './pages.module.css';

/** Layout for the legal pages: a quiet header and a readable text column with a section index. */
export function LegalPage({
  title,
  intro,
  updated,
  sections,
}: {
  title: string;
  intro: string;
  updated?: string;
  sections: Array<{ title: string; body: ReactNode }>;
}) {
  const id = (index: number) => `section-${index + 1}`;
  return (
    <>
      <section className={styles.legalHero} aria-labelledby="legal-title">
        <AmbientBackdrop />
        <div className={`container ${styles.legalHeroInner}`}>
          <p className="eyebrow">Legal</p>
          <h1 id="legal-title">{title}</h1>
          <p>{intro}</p>
          {updated ? <p className={styles.legalUpdated}>{updated}</p> : null}
        </div>
      </section>
      <div className={`container ${styles.legalBody}`}>
        <nav className={styles.legalToc} aria-label="On this page">
          <p>On this page</p>
          <ol>
            {sections.map((section, index) => (
              <li key={section.title}>
                <a href={`#${id(index)}`}>{section.title}</a>
              </li>
            ))}
          </ol>
        </nav>
        <article className={styles.legalArticle}>
          {sections.map((section, index) => (
            <section key={section.title} id={id(index)} aria-labelledby={`${id(index)}-title`}>
              <h2 id={`${id(index)}-title`}>
                <span>{index + 1}.</span> {section.title}
              </h2>
              {section.body}
            </section>
          ))}
        </article>
      </div>
    </>
  );
}
