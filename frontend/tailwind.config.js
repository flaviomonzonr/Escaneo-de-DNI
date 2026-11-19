/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta de Identidad Visual Chavín (Azul Marino, Azul Acero, Tonos Claros, Turquesa y Verde Petróleo)
        // ESTRICTO: Sin amarillo ni naranja
        chavin: {
          // Azul Marino (Base institucional, fondo y superficies solemnes)
          navy: {
            DEFAULT: '#0B1528',
            deep: '#060D1A',
            950: '#040914',
            900: '#070E1C',
            800: '#0B1528',
            700: '#101F3B',
            600: '#162A4F',
            500: '#1E3865',
          },
          // Azul Acero (Estructuras líticas, bordes de relieve tallado y neutrales técnicos)
          steel: {
            DEFAULT: '#416799',
            900: '#152438',
            800: '#1D334E',
            700: '#274468',
            600: '#345785',
            500: '#416799',
            400: '#5C84BA',
            300: '#7E9FD3',
            200: '#A8BFDF',
            100: '#D2DEF0',
            50: '#EBF1F9',
          },
          // Turquesa / Crisocola Andina (Acentos dinámicos, retículas, láser y foco)
          turquoise: {
            DEFAULT: '#06B6D4',
            light: '#22D3EE',
            glow: '#00E5FF',
            dark: '#0891B2',
            deep: '#0E7490',
          },
          // Verde Petróleo / Malaquita Profunda (Acciones secundarias, estados aprobados, celdas NISIRA)
          petroleum: {
            DEFAULT: '#0D9488',
            light: '#14B8A6',
            glow: '#2DD4BF',
            dark: '#0F766E',
            deep: '#115E59',
            base: '#0A3D44',
          },
          // Tonos Claros (Piedra caliza, nieve andina y alto contraste)
          light: {
            DEFAULT: '#F8FAFC',
            canvas: '#F1F5F9',
            card: '#FFFFFF',
            muted: '#E2E8F0',
            text: '#070E1C',
            subtext: '#1E293B',
          },
          // Alias funcionales
          primary: '#1D4ED8',
          border: '#243C5E',
          surface: '#0E1B33',
        },
        slate: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          950: '#020617',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Consolas', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(6, 13, 26, 0.4), 0 1px 2px -1px rgba(6, 13, 26, 0.4)',
        'card-hover': '0 12px 24px -6px rgba(6, 13, 26, 0.6), 0 4px 8px -4px rgba(6, 182, 212, 0.1)',
        'sidebar': '4px 0 24px rgba(4, 9, 20, 0.6)',
        'glow-turquoise': '0 0 20px rgba(6, 182, 212, 0.4)',
        'glow-petroleum': '0 0 20px rgba(13, 148, 136, 0.4)',
        'glow-steel': '0 0 20px rgba(65, 103, 153, 0.35)',
        'chavin-lithic': 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 4px 16px rgba(4, 9, 20, 0.5)',
        'glass': '0 8px 32px 0 rgba(7, 14, 28, 0.4)',
        'bottom-bar': '0 -4px 25px rgba(6, 13, 26, 0.6)',
      }
    },
  },
  plugins: [],
}
