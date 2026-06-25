/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        brand: {
          navy:        '#1B4965',
          'navy-dark': '#0f2b3c',
          'navy-mid':  '#143A52',
          'navy-light':'#2A6080',
          teal:        '#2EC4B6',
          'teal-dark': '#26a89b',
        },
        income:  '#10b981',
        expense: '#ef4444',
        amber: {
          highlight:        '#F5C518',
          'highlight-hover':'#E6B800',
          'highlight-text': '#92400E',
        },
      },
      boxShadow: {
        xs:           'var(--shadow-xs)',
        card:         'var(--shadow-sm)',
        'card-hover': 'var(--shadow-md)',
        float:        'var(--shadow-lg)',
        modal:        'var(--shadow-xl)',
      },
    },
  },
  plugins: [],
}
