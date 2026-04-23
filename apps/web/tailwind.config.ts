import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        zeever: {
          bg: '#F8FAFA',
          accent: '#96C6E3',
          primary: '#EB7F26',
          muted: '#AB93A8',
          text: '#1C72D8',
        },
      },
    },
  },
  plugins: [],
}
export default config
