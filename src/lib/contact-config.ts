/**
 * Centralized contact information for Quantivis Global.
 * Update values here — they propagate across the entire app.
 */

export const CONTACT = {
  company: "Quantivis Global",
  companyLegal: "Quantivis Global GmbH",
  domain: "quantivis.io",
  website: "https://www.quantivis.io",

  // Email addresses
  email: {
    general: "hello@quantivis.io",
    privacy: "privacy@quantivis.io",
    security: "security@quantivis.io",
    legal: "legal@quantivis.io",
    dpo: "dpo@quantivis.io",
  },

  // Phone
  phone: {
    display: "+49 179 145 5906",
    href: "tel:+491791455906",
  },

  // Social
  linkedin: "https://www.linkedin.com/company/quantivis-io/",

  // Location
  location: "Germany",
} as const;
