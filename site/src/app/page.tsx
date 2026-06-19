import Link from 'next/link';

export default function HomePage() {
  return (<main>
      {/* Hero Section */}
      <section className="hero">
        <h1>HexGrid 3D</h1>
        <p>
          A powerful React component for displaying content in an immersive 3D
          spherical hexagonal grid layout. Perfect for portfolios, galleries,
          and interactive visualizations.
        </p>
        <div
          style={{
            display: 'flex', 
            gap: '1rem', 
            flexWrap: 'wrap', 
            justifyContent: 'center', 
          }}
        >
          <Link href="/docs" className="button">
            Get Started
          </Link>
          <Link href="/examples" className="button button-secondary">
            View Examples
          </Link>
          <a
            href="https://github.com/buley/hexgrid-3d"
            target="_blank"
            rel="noopener noreferrer"
            className="button button-secondary"
          >
            GitHub
          </a>
        </div>
      </section>

      {/* Features Section */}
      <section className="section container">
        <h2
          style={{
            fontSize: '2.5rem', 
            marginBottom: '1rem', 
            textAlign: 'center', 
          }}
        >
          Powerful Features
        </h2>
        <p
          style={{
            textAlign: 'center', 
            color: '#a0a0a0', 
            marginBottom: '3rem', 
            fontSize: '1.2rem', 
          }}
        >
          Everything you need to create stunning 3D visualizations
        </p>
        <div className="features-grid">
          <div className="feature-card">
            <div
              style={{
                marginBottom: '1rem', 
                color: '#667eea', 
                fontSize: '2rem', 
              }}
            >
              📐
            </div>
            <h3>3D Hexagonal Grid</h3>
            <p>
              Spherical projection with customizable curvature. Display your
              content in an immersive 3D space that adapts to any viewport.
            </p>
          </div>

          <div className="feature-card">
            <div
              style={{
                marginBottom: '1rem', 
                color: '#667eea', 
                fontSize: '2rem', }}
            >
              📷
            </div>
            <h3>Interactive Camera</h3>
            <p>
              Pan, zoom, and rotate with smooth transitions. Support for mouse,
              touch, and keyboard controls with inside/outside views.
            </p>
          </div>

          <div className="feature-card">
            <div
              style={{
                marginBottom: '1rem', 
                color: '#667eea', 
                fontSize: '2rem', 
              }}
            >
              ⚡
            </div>
            <h3>High Performance</h3>
            <p>
              Web Worker rendering for 60fps performance. Automatic texture
              caching and adaptive quality based on device capabilities.
            </p>
          </div>

          <div className="feature-card">
            <div
              style={{
                marginBottom: '1rem', 
                color: '#667eea', 
                fontSize: '2rem', 
              }}
            >
              🎨
            </div>
            <h3>Dynamic Theming</h3>
            <p>
              Automatic accent color extraction from images. Seamless
              integration with your app&apos;s theme system.
            </p>
          </div>

          <div className="feature-card">
            <div
              style={{
                marginBottom: '1rem', 
                color: '#667eea', 
                fontSize: '2rem', }}
            >
              📱
            </div>
            <h3>Responsive Design</h3>
            <p>
              Fully responsive for mobile and desktop. Touch gestures,
              pinch-to-zoom, and adaptive layouts for all screen sizes.
            </p>
          </div>

          <div className="feature-card">
            <div
              style={{
                marginBottom: '1rem', 
                color: '#667eea', 
                fontSize: '2rem', 
              }}
            >
              💻
            </div>
            <h3>TypeScript Ready</h3>
            <p>
              Fully typed with comprehensive TypeScript definitions. Includes
              comprehensive tests and documentation.
            </p>
          </div>
        </div>
      </section>

      {/* Quick Start Section */}
      <section className="section container">
        <h2
          style={{
            fontSize: '2.5rem', 
            marginBottom: '2rem', 
            textAlign: 'center', }}
        >
          Quick Start
        </h2>
        <div className="code-block">
          <code>{`npm install @buley/hexgrid-3d`}</code>
        </div>
        <div className="code-block">
          <code>
            {`import { HexGrid, Photo } from '@buley/hexgrid-3d'

function MyComponent() {
  const photos: Photo[] = [
    {
      id: '1',
      url: 'https://example.com/photo.jpg',
      source: 'example',
      createdAt: new Date().toISOString()
    }
  ]

  return (
    <HexGrid
      photos={photos}
      onHexClick={(photo) => console.log('Clicked:', photo)}
    />
  )
}`}
          </code>
        </div>
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Link href="/docs" className="button">
            Read Full Documentation
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <p>&copy; 2024 HexGrid 3D. Personal Use Only License.</p>
          <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
            <a
              href="https://github.com/buley/hexgrid-3d"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#667eea' }}
            >
              View on GitHub
            </a>
            {' • '}
            <Link href="/docs" style={{ color: '#667eea' }}>
              Documentation
            </Link>
            {' • '}
            <Link href="/examples" style={{ color: '#667eea' }}>
              Examples
            </Link>
          </p>
        </div>
      </footer>
    </main>
  );
}
