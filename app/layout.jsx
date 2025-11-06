import './globals.css';

export const metadata = {
  title: 'Forex Scanner',
  description: 'Live FX rates via Alpha Vantage',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
