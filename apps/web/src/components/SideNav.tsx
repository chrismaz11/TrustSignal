'use client';

import { useEffect, useState } from 'react';

const navItems = [
  { id: 'hero', label: 'TrustSignal' },
  { id: 'signals', label: 'Signals' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'contact', label: 'Contact' }
];

export function SideNav() {
  const [activeSection, setActiveSection] = useState('hero');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.35, rootMargin: '-10% 0px -45% 0px' }
    );

    navItems.forEach(({ id }) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    const section = document.getElementById(id);
    if (!section) return;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav className="side-nav" aria-label="Section navigation">
      {navItems.map(({ id, label }) => {
        const isActive = activeSection === id;
        return (
          <button
            key={id}
            type="button"
            className={`side-nav__item ${isActive ? 'is-active' : ''}`}
            onClick={() => scrollToSection(id)}
            aria-label={`Go to ${label}`}
          >
            <span className="side-nav__dot" aria-hidden="true" />
            <span className="side-nav__label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
