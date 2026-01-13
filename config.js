// Configuration for sites and selectors
// Add your target sites and CSS selectors here
const SITE_CONFIG = [
  {
    hostname: 'supabase.com',
    selectors: ['#sb-docs-guide-main-article', 'section.grid.gap-x-16.gap-y-8'],
  },
]

// Get configuration for current site
function getConfigForCurrentSite() {
  const hostname = window.location.hostname.replace('www.', '')
  return SITE_CONFIG.find((config) => hostname.includes(config.hostname))
}
