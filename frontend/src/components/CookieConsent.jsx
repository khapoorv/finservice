import React, { useState, useEffect } from 'react';
import api from '../services/api';

// Cookie consent component for GDPR and CCPA compliance
function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [consent, setConsent] = useState({
    essential: true, // Always required, cannot be disabled
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const savedConsent = localStorage.getItem('cookieConsent');
    if (!savedConsent) {
      setShowBanner(true);
    } else {
      setConsent(JSON.parse(savedConsent));
    }
  }, []);

  const handleAcceptAll = async () => {
    const fullConsent = { essential: true, analytics: true, marketing: true };
    await saveConsent(fullConsent);
  };

  const handleRejectNonEssential = async () => {
    const minimalConsent = { essential: true, analytics: false, marketing: false };
    await saveConsent(minimalConsent);
  };

  const handleSavePreferences = async () => {
    await saveConsent(consent);
    setShowPreferences(false);
  };

  const saveConsent = async (consentData) => {
    localStorage.setItem('cookieConsent', JSON.stringify(consentData));
    setConsent(consentData);
    setShowBanner(false);

    // Send consent to server for GDPR record-keeping
    try {
      await api.post('/api/gdpr/cookie-consent', {
        ...consentData,
        userId: localStorage.getItem('userId') || null,
      });
    } catch (error) {
      console.error('Failed to record consent:', error);
    }

    // Enable/disable analytics based on consent
    if (consentData.analytics) {
      enableAnalytics();
    } else {
      disableAnalytics();
    }

    if (consentData.marketing) {
      enableMarketingTracking();
    }
  };

  const enableAnalytics = () => {
    // Initialize Google Analytics
    window.gtag?.('config', 'GA_TRACKING_ID', { anonymize_ip: true });
  };

  const disableAnalytics = () => {
    // Disable GA tracking
    window['ga-disable-GA_TRACKING_ID'] = true;
  };

  const enableMarketingTracking = () => {
    // Enable marketing pixels (Facebook, etc.)
    console.log('Marketing tracking enabled');
  };

  if (!showBanner) return null;

  return (
    <div className="cookie-consent-banner" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      backgroundColor: '#1a1a2e', color: '#fff', padding: '20px',
      zIndex: 9999, boxShadow: '0 -2px 10px rgba(0,0,0,0.3)',
    }}>
      {!showPreferences ? (
        <div className="cookie-main">
          <div className="cookie-text">
            <h3>Cookie Notice</h3>
            <p>
              We use cookies to enhance your experience. Essential cookies are required for
              the site to function. You can choose to enable analytics and marketing cookies.
              Read our <a href="/privacy" style={{ color: '#4ecdc4' }}>Privacy Policy</a> and{' '}
              <a href="/cookies" style={{ color: '#4ecdc4' }}>Cookie Policy</a>.
            </p>
            <p style={{ fontSize: '12px', marginTop: '8px' }}>
              By using this site, you acknowledge our use of essential cookies.
              California residents: see our <a href="/ccpa" style={{ color: '#4ecdc4' }}>CCPA Notice</a>.
            </p>
          </div>
          <div className="cookie-actions" style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button onClick={handleAcceptAll} style={{ padding: '10px 20px', backgroundColor: '#4ecdc4', border: 'none', cursor: 'pointer' }}>
              Accept All
            </button>
            <button onClick={handleRejectNonEssential} style={{ padding: '10px 20px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', cursor: 'pointer' }}>
              Essential Only
            </button>
            <button onClick={() => setShowPreferences(true)} style={{ padding: '10px 20px', backgroundColor: 'transparent', color: '#4ecdc4', border: '1px solid #4ecdc4', cursor: 'pointer' }}>
              Manage Preferences
            </button>
          </div>
        </div>
      ) : (
        <div className="cookie-preferences">
          <h3>Cookie Preferences</h3>
          <div style={{ margin: '10px 0' }}>
            <label>
              <input type="checkbox" checked={true} disabled /> Essential Cookies (Required)
            </label>
            <p style={{ fontSize: '12px', marginLeft: '20px' }}>
              Required for site functionality: authentication, cart, security.
            </p>
          </div>
          <div style={{ margin: '10px 0' }}>
            <label>
              <input
                type="checkbox"
                checked={consent.analytics}
                onChange={(e) => setConsent({ ...consent, analytics: e.target.checked })}
              /> Analytics Cookies
            </label>
            <p style={{ fontSize: '12px', marginLeft: '20px' }}>
              Help us understand how you use the site (Google Analytics, Mixpanel).
            </p>
          </div>
          <div style={{ margin: '10px 0' }}>
            <label>
              <input
                type="checkbox"
                checked={consent.marketing}
                onChange={(e) => setConsent({ ...consent, marketing: e.target.checked })}
              /> Marketing Cookies
            </label>
            <p style={{ fontSize: '12px', marginLeft: '20px' }}>
              Used for personalized advertising and retargeting.
            </p>
          </div>
          <button onClick={handleSavePreferences} style={{ padding: '10px 20px', backgroundColor: '#4ecdc4', border: 'none', cursor: 'pointer' }}>
            Save Preferences
          </button>
        </div>
      )}
    </div>
  );
}

export default CookieConsent;
