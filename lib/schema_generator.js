/**
 * Dynamic Structured Data (Schema.org / JSON-LD) Generator
 * Generates valid LocalBusiness, BreadcrumbList, and Organization schema markup
 * scalable across all ~5,570 Brazilian municipalities.
 */

const { validateLocality } = require("./localities");

/**
 * Generate LocalBusiness JSON-LD Schema
 * @param {Object} place - Business listing data
 * @param {Object} locality - Locality configuration (IBGE compliance)
 * @param {string} baseUrl - Domain base URL (e.g., https://guarulhos-aberta.vercel.app)
 * @returns {Object} JSON-LD Schema object
 */
function generateLocalBusinessSchema(place, locality, baseUrl = "https://guarulhos-aberta.vercel.app") {
  const validatedLocality = validateLocality(locality);
  const cleanBaseUrl = baseUrl.replace(/\/$/, "");

  const categorySlug = place.categorySlug || "empresa";
  const businessSlug = place.slug || (place.id ? `empresa-${place.id}` : "empresa");
  const canonicalUrl = `${cleanBaseUrl}/${validatedLocality.stateSlug}/${validatedLocality.municipalitySlug}/${categorySlug}/${businessSlug}`;

  const schema = {
    "@context": "https://schema.org",
    "@type": place.type || "LocalBusiness",
    "@id": canonicalUrl,
    "name": place.name || "Empresa Local",
    "url": place.website || canonicalUrl,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": validatedLocality.municipalityName,
      "addressRegion": validatedLocality.stateCode,
      "addressCountry": "BR"
    }
  };

  if (place.street) {
    schema.address.streetAddress = place.street;
  }
  if (place.postcode) {
    schema.address.postalCode = place.postcode;
  }
  if (place.phone) {
    schema.telephone = place.phone;
  }
  if (place.lat && place.lon) {
    schema.geo = {
      "@type": "GeoCoordinates",
      "latitude": parseFloat(place.lat),
      "longitude": parseFloat(place.lon)
    };
  }
  if (place.description) {
    schema.description = place.description;
  }

  return schema;
}

/**
 * Generate BreadcrumbList JSON-LD Schema
 * @param {Object} locality - Locality configuration
 * @param {string} [categoryName] - Category display name
 * @param {string} [categorySlug] - Category URL slug
 * @param {string} [businessName] - Business display name
 * @param {string} [businessSlug] - Business URL slug
 * @param {string} baseUrl - Domain base URL
 * @returns {Object} JSON-LD Schema object
 */
function generateBreadcrumbSchema(locality, categoryName, categorySlug, businessName, businessSlug, baseUrl = "https://guarulhos-aberta.vercel.app") {
  const validatedLocality = validateLocality(locality);
  const cleanBaseUrl = baseUrl.replace(/\/$/, "");

  const itemListElement = [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Início",
      "item": cleanBaseUrl
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": `${validatedLocality.municipalityName} (${validatedLocality.stateCode})`,
      "item": `${cleanBaseUrl}/${validatedLocality.stateSlug}/${validatedLocality.municipalitySlug}`
    }
  ];

  if (categoryName && categorySlug) {
    itemListElement.push({
      "@type": "ListItem",
      "position": 3,
      "name": categoryName,
      "item": `${cleanBaseUrl}/${validatedLocality.stateSlug}/${validatedLocality.municipalitySlug}/${categorySlug}`
    });

    if (businessName && businessSlug) {
      itemListElement.push({
        "@type": "ListItem",
        "position": 4,
        "name": businessName,
        "item": `${cleanBaseUrl}/${validatedLocality.stateSlug}/${validatedLocality.municipalitySlug}/${categorySlug}/${businessSlug}`
      });
    }
  }

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": itemListElement
  };
}

module.exports = {
  generateLocalBusinessSchema,
  generateBreadcrumbSchema
};
