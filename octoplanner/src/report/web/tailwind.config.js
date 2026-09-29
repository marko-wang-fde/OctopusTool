export default {
  content: {
    relative: true,
    files: ['./index.html', './src/**/*.{ts,tsx}']
  },
  theme: {
    extend: {
      colors: {
        border: '#e5e7eb',
        background: '#f8fafc',
        foreground: '#111827',
        muted: '#6b7280',
        primary: '#2563eb',
        surface: '#ffffff'
      }
    }
  },
  plugins: []
}
