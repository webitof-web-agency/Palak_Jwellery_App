const PALETTES = {
  roseLight: {
    '--jsm-ink': '#09111f',
    '--jsm-bg': '#fbf6f0',
    '--jsm-surface': '#fffaf5',
    '--jsm-surface-strong': '#f3e8da',
    '--jsm-surface-muted': '#f7efe7',
    '--jsm-panel-bg': 'rgba(255, 250, 245, 0.92)',
    '--jsm-panel-bg-soft': 'rgba(247, 239, 231, 0.90)',
    '--jsm-panel-bg-faint': 'rgba(255, 255, 255, 0.70)',
    '--jsm-panel-border': 'rgba(92, 70, 56, 0.14)',
    '--jsm-panel-border-strong': 'rgba(92, 70, 56, 0.20)',
    '--jsm-text': '#261c18',
    '--jsm-text-soft': 'rgba(38, 28, 24, 0.84)',
    '--jsm-text-muted': 'rgba(38, 28, 24, 0.64)',
    '--jsm-text-faint': 'rgba(38, 28, 24, 0.44)',
    '--jsm-heading': '#b95c58',
    '--jsm-on-accent': '#fffaf5',
    '--jsm-border': 'var(--jsm-panel-border)',
    '--jsm-border-strong': 'var(--jsm-panel-border-strong)',
    '--jsm-gold-500': '#c87368',
    '--jsm-gold-600': '#b95c58',
    '--jsm-gold-700': '#9f4a49',
    '--jsm-accent-amber': '#b97a3a',
    '--jsm-accent-red': '#b34949',
    '--jsm-accent-green': '#2f8a64',
    '--jsm-shadow-premium':
      '0 16px 48px rgba(76, 53, 43, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.70)',
    '--jsm-control-bg': 'rgba(255, 255, 255, 0.72)',
    '--jsm-control-bg-hover': 'rgba(255, 255, 255, 0.82)',
    '--jsm-success-bg': 'rgba(99, 200, 135, 0.12)',
    '--jsm-success-border': 'rgba(99, 200, 135, 0.24)',
    '--jsm-success-text': '#d8f5e2',
    '--jsm-danger-bg': 'rgba(242, 110, 110, 0.08)',
    '--jsm-danger-border': 'rgba(242, 110, 110, 0.30)',
    '--jsm-danger-text': '#ffcbcb',
    '--jsm-warning-bg': 'rgba(242, 181, 84, 0.10)',
    '--jsm-warning-border': 'rgba(242, 181, 84, 0.24)',
    '--jsm-warning-text': '#ffdfaa',
    '--jsm-bg-gradient':
      'radial-gradient(circle at 0% 0%, rgba(200, 115, 104, 0.10) 0%, transparent 46%), radial-gradient(circle at 100% 0%, rgba(185, 92, 88, 0.08) 0%, transparent 42%)',
    '--jsm-card-gradient':
      'linear-gradient(180deg, rgba(255, 250, 245, 0.92) 0%, rgba(247, 239, 231, 0.90) 100%)',
  },
  midnightRose: {
    '--jsm-ink': '#09111f',
    '--jsm-bg': '#030811',
    '--jsm-surface': '#07111f',
    '--jsm-surface-strong': '#0e1828',
    '--jsm-surface-muted': '#0b1524',
    '--jsm-panel-bg': 'rgba(9, 15, 27, 0.82)',
    '--jsm-panel-bg-soft': 'rgba(255, 255, 255, 0.04)',
    '--jsm-panel-bg-faint': 'rgba(255, 255, 255, 0.03)',
    '--jsm-panel-border': 'rgba(255, 255, 255, 0.08)',
    '--jsm-panel-border-strong': 'rgba(255, 255, 255, 0.12)',
    '--jsm-text': '#f4f0ea',
    '--jsm-text-soft': 'rgba(244, 240, 234, 0.88)',
    '--jsm-text-muted': 'rgba(244, 240, 234, 0.60)',
    '--jsm-text-faint': 'rgba(244, 240, 234, 0.40)',
    '--jsm-heading': '#e5b463',
    '--jsm-on-accent': '#f4f0ea',
    '--jsm-border': 'var(--jsm-panel-border)',
    '--jsm-border-strong': 'var(--jsm-panel-border-strong)',
    '--jsm-gold-500': '#e5b463',
    '--jsm-gold-600': '#d6a24f',
    '--jsm-gold-700': '#b8863a',
    '--jsm-accent-amber': '#e57c1a',
    '--jsm-accent-red': '#c0392b',
    '--jsm-accent-green': '#27ae60',
    '--jsm-shadow-premium':
      '0 12px 40px rgba(0, 0, 0, 0.50), inset 0 1px 1px rgba(255, 255, 255, 0.03)',
    '--jsm-control-bg': 'rgba(255, 255, 255, 0.04)',
    '--jsm-control-bg-hover': 'rgba(255, 255, 255, 0.07)',
    '--jsm-success-bg': 'rgba(99, 200, 135, 0.12)',
    '--jsm-success-border': 'rgba(99, 200, 135, 0.24)',
    '--jsm-success-text': '#d8f5e2',
    '--jsm-danger-bg': 'rgba(242, 110, 110, 0.08)',
    '--jsm-danger-border': 'rgba(242, 110, 110, 0.30)',
    '--jsm-danger-text': '#ffcbcb',
    '--jsm-warning-bg': 'rgba(242, 181, 84, 0.10)',
    '--jsm-warning-border': 'rgba(242, 181, 84, 0.24)',
    '--jsm-warning-text': '#ffdfaa',
    '--jsm-bg-gradient':
      'radial-gradient(circle at 0% 0%, rgba(229, 180, 99, 0.05) 0%, transparent 50%)',
    '--jsm-card-gradient':
      'linear-gradient(180deg, rgba(7, 17, 31, 0.80) 0%, rgba(3, 8, 17, 0.72) 100%)',
  },
}

export const DEFAULT_THEME = 'roseLight'
export const THEME_STORAGE_KEY = 'jewellery-admin-theme'
export const APP_BRAND_NAME = 'Jewellery Management'
export const APP_BRAND_SHORT = 'Jewellery'
export const APP_BRAND_TAGLINE = 'Management Console'

const THEME_ASSETS = {
  roseLight: {
    favicon: '/favicon-light-circle.png',
    themeColor: '#fbf6f0',
  },
  midnightRose: {
    favicon: '/favicon-dark-circle.png',
    themeColor: '#030811',
  },
}

function updateThemeAssets(themeName) {
  if (typeof document === 'undefined') {
    return
  }

  const asset = THEME_ASSETS[themeName] ?? THEME_ASSETS[DEFAULT_THEME]
  const existingIcon = document.querySelector("link[rel='icon']")
  const existingThemeColor = document.querySelector("meta[name='theme-color']")

  if (existingIcon) {
    existingIcon.setAttribute('href', asset.favicon)
  }

  if (existingThemeColor) {
    existingThemeColor.setAttribute('content', asset.themeColor)
  }
}

export function applyTheme(themeName = DEFAULT_THEME) {
  const palette = PALETTES[themeName] ?? PALETTES[DEFAULT_THEME]
  const root = document.documentElement

  root.dataset.theme = themeName in PALETTES ? themeName : DEFAULT_THEME
  root.style.colorScheme = root.dataset.theme === 'midnightRose' ? 'dark' : 'light'

  Object.entries(palette).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })

  updateThemeAssets(root.dataset.theme)

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, root.dataset.theme)
  } catch {
    // Ignore storage failures in private browsing or restricted contexts.
  }
}

export function loadTheme() {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (saved === 'roseLight' || saved === 'midnightRose') {
      return saved
    }
  } catch {
    // Ignore storage failures in private browsing or restricted contexts.
  }

  return DEFAULT_THEME
}

export function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === 'midnightRose'
    ? 'roseLight'
    : 'midnightRose'
  applyTheme(nextTheme)
  return nextTheme
}

export function getThemeNames() {
  return Object.keys(PALETTES)
}
