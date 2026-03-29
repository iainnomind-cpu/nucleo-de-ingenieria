/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'primary': '#13b6ec',
        'primary-content': '#ffffff',
        'primary-dark': '#0e8db8',
        'background-light': '#f6f8f8',
        'background-dark': '#101d22',
        'surface-light': '#ffffff',
        'surface-dark': '#1a2c33',
        'text-main': '#0f172a',
        'text-muted': '#64748b',
        'accent-success': '#10b981',
        'accent-warning': '#f59e0b',
        'accent-danger': '#ef4444',
      },
      fontFamily: {
        'display': ['Inter', 'sans-serif'],
        'body': ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
