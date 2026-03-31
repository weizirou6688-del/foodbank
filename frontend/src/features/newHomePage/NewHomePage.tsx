import React from 'react';
import './NewHomePage.module.css';

// 新首页主组件，完全隔离于现有 Home 页面
const NewHomePage: React.FC = () => {
  return (
    <div className="new-homepage-container">
      {/* Banner 区域 */}
      <section className="banner-section">
        <span className="tag">COMMUNITY FIRST</span>
        <h1>Fighting Hunger,<br/>Building <span className="highlight">Community</span></h1>
        <p>Find your nearest food bank, donate to those in need, or get support for your family — all in one place.</p>
        <div className="banner-actions">
          <button className="primary">Find a Food Bank</button>
          <button className="secondary">Donate Now</button>
        </div>
      </section>

      {/* 查找最近食物银行 */}
      <section className="find-section">
        <span className="tag">NEAR YOU</span>
        <h2>Find Your Nearest Food Bank</h2>
        <p>Enter your postcode to see food banks within 2 miles.</p>
        <div className="search-box">
          <input type="text" placeholder="e.g. SW1A 1AA" />
          <button className="primary">Search</button>
        </div>
      </section>

      {/* How You Can Help 区域 */}
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

      {/* Footer 区域 */}
      <footer className="footer">
        <span>ABC <span className="highlight">Foodbank</span></span>
        <nav>
          <a href="#">About Us</a>
          <a href="#">Contact</a>
          <a href="#">FAQs</a>
          <a href="#">Privacy Policy</a>
        </nav>
        <small>© 2026 ABC Community Food Bank. Registered Charity No. 1234567. All Rights Reserved.</small>
      </footer>
    </div>
  );
};

export default NewHomePage;
