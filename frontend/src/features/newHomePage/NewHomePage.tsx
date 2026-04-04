import React from 'react';
import PublicSiteFooter from '@/shared/ui/PublicSiteFooter';
import './NewHomePage.module.css';

const NewHomePage: React.FC = () => {
  return (
    <div className="new-homepage-container">
      <section className="banner-section">
        <span className="tag">COMMUNITY FIRST</span>
        <h1>Fighting Hunger,<br/>Building <span className="highlight">Community</span></h1>
        <p>Find your nearest food bank, donate to those in need, or get support for your family all in one place.</p>
        <div className="banner-actions">
          <button className="primary">Find a Food Bank</button>
          <button className="secondary">Donate Now</button>
        </div>
      </section>

      <section className="find-section">
        <span className="tag">NEAR YOU</span>
        <h2>Find Your Nearest Food Bank</h2>
        <p>Enter your postcode to see food banks within 2 miles.</p>
        <div className="search-box">
          <input type="text" placeholder="e.g. SW1A 1AA" />
          <button className="primary">Search</button>
        </div>
      </section>

      <section className="help-section">
        <h2>How You Can Help</h2>
        <p>Every contribution makes a real difference to families in need.</p>
        <div className="help-cards">
          <div className="card donate-cash">
            <h3>Donate Cash</h3>
            <p>100% of your donation goes directly to supporting local families in need.</p>
            <button className="primary">Donate Now</button>
          </div>
          <div className="card donate-goods">
            <h3>Donate Goods</h3>
            <p>Donate non-perishable food items and toiletries to your local food bank.</p>
            <button className="secondary">Donate Goods</button>
          </div>
        </div>
      </section>

      <PublicSiteFooter />
    </div>
  );
};

export default NewHomePage;
