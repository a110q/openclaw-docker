import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          500: '#f43f5e',
          600: '#e11d48'
        }
      }
    }
  },
  plugins: []
};

export default config;
