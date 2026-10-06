import "./globals.css";

export const metadata = { title: "e2e next" };

export default function RootLayout({ children }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
