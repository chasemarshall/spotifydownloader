import type { Metadata } from "next";
import { Inter, Special_Elite } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const specialElite = Special_Elite({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-typewriter",
});

export const metadata: Metadata = {
  title: "sonata. | Download Your Favorite Tracks",
  description: "Convert Spotify tracks to MP3 files. Fast, free, and easy to use.",
  keywords: ["spotify", "downloader", "mp3", "music", "converter", "sonata"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${specialElite.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
