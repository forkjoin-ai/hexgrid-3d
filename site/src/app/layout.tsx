import React from '@a0n/raect';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'HexGrid 3D - Immersive 3D Hexagonal Grid Visualization',
  description:
    'A powerful React component for displaying content in an immersive 3D spherical hexagonal grid layout. Perfect for portfolios, galleries, and interactive visualizations.',
  keywords: [
    '3D',
    'hexgrid',
    'visualization',
    'react',
    'three.js',
    'spherical',
    'interactive',
  ],
  authors: [{ name: 'buley' }],
  openGraph: {
    title: 'HexGrid 3D - Immersive 3D Hexagonal Grid Visualization',
    description:
      'A powerful React component for displaying content in an immersive 3D spherical hexagonal grid layout.',
    type: 'website',
  },
};

export default function RootLayout({
  children: unknown,  
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
