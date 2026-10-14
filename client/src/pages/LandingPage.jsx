import React from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Check,
  CircleAlert,
  Clock3,
  Layers3,
  PackageCheck,
  ScanLine,
  ShieldCheck,
  ShoppingCart,
  Store,
  TrendingUp,
} from 'lucide-react';
import './LandingPage.css';

const features = [
  {
    icon: Boxes,
    number: '01',
    title: 'Know what’s on your shelves',
    description:
      'Keep products, batches, and stock levels together. Spot low inventory and approaching expiry dates before they become a scramble.',
  },
  {
    icon: ShoppingCart,
    number: '02',
    title: 'Keep every handoff moving',
    description:
      'Bring supplier orders, receiving, and point-of-sale operations into one connected workspace for your whole team.',
  },
  {
    icon: BarChart3,
    number: '03',
    title: 'Make the next move with clarity',
    description:
      'Turn sales, stock, and store activity into reports your team can actually use to make better day-to-day decisions.',
  },
];

const LandingPage = () => {
  const { user } = useSelector((state) => state.auth);
  const startPath = user ? '/dashboard' : '/register';

  return (
    <div className="landing-page">
      <header className="landing-header">
        <Link className="landing-brand" to="/" aria-label="SDMAS home">
          <span className="landing-brand-mark"><Store size={19} strokeWidth={2.3} /></span>
          <span>sdmas<span className="landing-brand-period">.</span></span>
        </Link>
        <nav className="landing-nav" aria-label="Main navigation">
          <a href="#features">Platform</a>
          <a href="#workflow">How it works</a>
        </nav>
        <div className="landing-header-actions">
          <Link className="landing-sign-in" to="/login">{user ? 'Your workspace' : 'Sign in'}</Link>
          <Link className="landing-header-cta" to={startPath}>
            {user ? 'Open dashboard' : 'Get started'} <ArrowUpRight size={15} />
          </Link>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <div className="landing-eyebrow"><span /> A calmer way to run retail</div>
            <h1>Good retail runs<br />on <span>good rhythm.</span></h1>
            <p className="landing-hero-description">
              Inventory, purchasing, billing, and insights — finally working
              together. Spend less time chasing the details and more time
              growing your store.
            </p>
            <div className="landing-hero-actions">
              <Link className="landing-primary-button" to={startPath}>
                {user ? 'Go to your dashboard' : 'Bring your store into sync'}
                <ArrowRight size={17} />
              </Link>
              <a className="landing-secondary-link" href="#features">
                Explore the platform <ArrowDown size={15} />
              </a>
            </div>
            <div className="landing-trust-note">
              <ShieldCheck size={16} />
              <span>Built for the people behind every great store.</span>
            </div>
          </div>

          <div className="landing-preview-wrap" aria-label="Preview of the SDMAS store dashboard">
            <div className="landing-preview-orbit landing-preview-orbit-one" />
            <div className="landing-preview-orbit landing-preview-orbit-two" />
            <div className="landing-preview">
              <div className="preview-topbar">
                <div className="preview-window-dots"><i /><i /><i /></div>
                <span>WORKSPACE PREVIEW</span>
                <span className="preview-live">DEMO VIEW</span>
              </div>
              <div className="preview-heading">
                <div>
                  <span className="preview-kicker">A FRESH LOOK AT YOUR STORE</span>
                  <h2>Good morning, team <span>✳</span></h2>
                </div>
                <span className="preview-avatar">S</span>
              </div>
              <div className="preview-stats">
                <div className="preview-stat">
                  <span>Today’s sales</span>
                  <strong>₹ 48,290</strong>
                  <small><TrendingUp size={12} /> On track today</small>
                </div>
                <div className="preview-stat">
                  <span>Items in stock</span>
                  <strong>1,284</strong>
                  <small><PackageCheck size={12} /> Across your store</small>
                </div>
              </div>
              <div className="preview-chart-card">
                <div className="preview-chart-heading">
                  <div><span>SALES OVERVIEW</span><strong>This week</strong></div>
                  <span className="preview-chart-trend">+12.8% <ArrowUpRight size={12} /></span>
                </div>
                <div className="preview-chart" aria-hidden="true">
                  <div className="preview-chart-grid"><i /><i /><i /></div>
                  <svg viewBox="0 0 440 98" preserveAspectRatio="none" role="img" aria-label="Illustrative upward sales chart">
                    <defs>
                      <linearGradient id="previewFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#76967e" stopOpacity=".25" />
                        <stop offset="100%" stopColor="#76967e" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0 78 C24 75 31 60 57 66 S95 72 112 51 S151 61 170 47 S204 53 224 35 S259 44 280 30 S313 37 335 22 S370 35 392 13 S424 22 440 7 V98 H0Z" fill="url(#previewFill)" />
                    <path d="M0 78 C24 75 31 60 57 66 S95 72 112 51 S151 61 170 47 S204 53 224 35 S259 44 280 30 S313 37 335 22 S370 35 392 13 S424 22 440 7" fill="none" stroke="#76967e" strokeWidth="3" vectorEffect="non-scaling-stroke" />
                    <circle cx="392" cy="13" r="4" fill="#76967e" />
                  </svg>
                </div>
                <div className="preview-chart-labels"><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span></div>
              </div>
              <div className="preview-bottom-row">
                <div className="preview-alert"><span className="preview-alert-icon"><CircleAlert size={15} /></span><span><strong>Needs a quick look</strong><small>3 products running low</small></span><ArrowRight size={14} /></div>
                <div className="preview-sync"><Clock3 size={13} /> Updated just now</div>
              </div>
            </div>
            <div className="preview-float-card">
              <span className="preview-float-icon"><ScanLine size={16} /></span>
              <span><strong>Stock, sorted.</strong><small>Stay a step ahead</small></span>
              <span className="preview-float-check"><Check size={13} /></span>
            </div>
          </div>
        </section>

        <section className="landing-intro" id="workflow">
          <span className="landing-section-label">ONE STORE. ONE CLEAR PICTURE.</span>
          <p>From the stockroom to the checkout, every part of your operation belongs in the same conversation.</p>
          <div className="landing-flow" aria-label="Store workflow">
            <span><Layers3 size={17} /> Stock</span>
            <i />
            <span><ShoppingCart size={17} /> Orders</span>
            <i />
            <span><Store size={17} /> Sales</span>
            <i />
            <span><BarChart3 size={17} /> Insights</span>
          </div>
        </section>

        <section className="landing-features" id="features">
          <div className="landing-features-heading">
            <div>
              <span className="landing-section-label">THE WHOLE PICTURE, FINALLY</span>
              <h2>Less juggling.<br /><span>More good days.</span></h2>
            </div>
            <p>Thoughtful tools for the real work of running a store — connected by design, simple by nature.</p>
          </div>
          <div className="landing-feature-grid">
            {features.map(({ icon: Icon, number, title, description }) => (
              <article className="landing-feature-card" key={number}>
                <div className="landing-feature-card-top">
                  <span className="landing-feature-icon"><Icon size={19} /></span>
                  <span>{number}</span>
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
                <span className="landing-feature-arrow"><ArrowUpRight size={17} /></span>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-cta">
          <div className="landing-cta-mark"><Store size={20} /></div>
          <div>
            <span className="landing-section-label">MAKE ROOM FOR WHAT’S NEXT</span>
            <h2>Your store deserves a little more flow.</h2>
          </div>
          <Link className="landing-cta-button" to={startPath}>
            {user ? 'Open your workspace' : 'Get started'} <ArrowRight size={16} />
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <Link className="landing-brand" to="/">
          <span className="landing-brand-mark"><Store size={16} /></span>
          <span>sdmas<span className="landing-brand-period">.</span></span>
        </Link>
        <span>Thoughtful systems for everyday retail.</span>
        <span>© {new Date().getFullYear()} SDMAS</span>
      </footer>
    </div>
  );
};

export default LandingPage;
