import Link from 'next/link';

export const metadata = {
  title: 'Documentation - HexGrid 3D',
  description: 'Complete documentation for HexGrid 3D component',
};

/**
 * Renders the Docs Page view.
 */
export default function DocsPage() {
  return (
    <div
      className="container"
      style={{ paddingTop: '4rem',  paddingBottom: '4rem' }}
    >
      <Link
        href="/"
        style={{
          color: '#667eea', 
          marginBottom: '2rem', 
          display: 'inline-block', 
        }}
      >
        ← Back to Home
      </Link>

      <h1 style={{ fontSize: '3rem',  marginBottom: '1rem' }}>Documentation</h1>
      <p style={{ color: '#a0a0a0',  marginBottom: '3rem',  fontSize: '1.2rem' }}>
        Complete guide to using HexGrid 3D in your projects
      </p>

      <div style={{ display: 'grid',  gap: '2rem' }}>
        <section>
          <h2 style={{ fontSize: '2rem',  marginBottom: '1rem' }}>
            Installation
          </h2>
          <div className="code-block">
            <code>npm install @buley/hexgrid-3d</code>
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: '2rem',  marginBottom: '1rem' }}>
            Basic Usage
          </h2>
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
        </section>

        <section>
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Props</h2>
          <div
            style={{
              background: '#1a1a1a',
              padding: '1.5rem',
              borderRadius: '8px',
              border: '1px solid #2a2a2a',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                  <th
                    style={{
                      padding: '0.75rem',
                      textAlign: 'left',
                      color: '#fff',
                    }}
                  >
                    Prop
                  </th>
                  <th
                    style={{
                      padding: '0.75rem',
                      textAlign: 'left',
                      color: '#fff',
                    }}
                  >
                    Type
                  </th>
                  <th
                    style={{
                      padding: '0.75rem',
                      textAlign: 'left',
                      color: '#fff',
                    }}
                  >
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                  <td style={{ padding: '0.75rem', color: '#a0a0a0' }}>
                    <code>photos</code>
                  </td>
                  <td style={{ padding: '0.75rem', color: '#a0a0a0' }}>
                    <code>Photo[]</code>
                  </td>
                  <td style={{ padding: '0.75rem', color: '#a0a0a0' }}>
                    Array of photos to display
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                  <td style={{ padding: '0.75rem', color: '#a0a0a0' }}>
                    <code>onHexClick</code>
                  </td>
                  <td style={{ padding: '0.75rem', color: '#a0a0a0' }}>
                    <code>(photo: Photo) =&gt; void</code>
                  </td>
                  <td style={{ padding: '0.75rem', color: '#a0a0a0' }}>
                    Callback when hex is clicked
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                  <td style={{ padding: '0.75rem', color: '#a0a0a0' }}>
                    <code>spacing</code>
                  </td>
                  <td style={{ padding: '0.75rem', color: '#a0a0a0' }}>
                    <code>number</code>
                  </td>
                  <td style={{ padding: '0.75rem', color: '#a0a0a0' }}>
                    Grid spacing multiplier
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '0.75rem', color: '#a0a0a0' }}>
                    <code>canvasRef</code>
                  </td>
                  <td style={{ padding: '0.75rem', color: '#a0a0a0' }}>
                    <code>RefObject</code>
                  </td>
                  <td style={{ padding: '0.75rem', color: '#a0a0a0' }}>
                    Optional canvas reference
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
            Camera Controls
          </h2>
          <div
            style={{
              background: '#1a1a1a',
              padding: '1.5rem',
              borderRadius: '8px',
              border: '1px solid #2a2a2a',
            }}
          >
            <h3 style={{ marginBottom: '1rem', color: '#fff' }}>
              Mouse/Trackpad
            </h3>
            <ul
              style={{
                color: '#a0a0a0',
                lineHeight: '1.8',
                marginLeft: '1.5rem',
              }}
            >
              <li>Left Click + Drag - Rotate camera (yaw and pitch)</li>
              <li>Scroll - Zoom in/out</li>
              <li>Click on Hex - Select photo</li>
            </ul>

            <h3
              style={{ marginTop: '2rem', marginBottom: '1rem', color: '#fff' }}
            >
              Touch
            </h3>
            <ul
              style={{
                color: '#a0a0a0',
                lineHeight: '1.8',
                marginLeft: '1.5rem',
              }}
            >
              <li>Single Touch Drag - Rotate camera</li>
              <li>Pinch - Zoom in/out</li>
              <li>Tap on Hex - Select photo</li>
            </ul>

            <h3
              style={{ marginTop: '2rem', marginBottom: '1rem', color: '#fff' }}
            >
              Keyboard
            </h3>
            <ul
              style={{
                color: '#a0a0a0',
                lineHeight: '1.8',
                marginLeft: '1.5rem',
              }}
            >
              <li>D - Toggle debug panel</li>
              <li>Escape - Close debug panel</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
            Performance
          </h2>
          <p
            style={{
              color: '#a0a0a0',
              lineHeight: '1.8',
              marginBottom: '1rem',
            }}
          >
            HexGrid 3D uses Web Workers for heavy calculations to maintain 60fps
            rendering:
          </p>
          <ul
            style={{
              color: '#a0a0a0',
              lineHeight: '1.8',
              marginLeft: '1.5rem',
            }}
          >
            <li>Streaming Rendering - Progressively renders tiles</li>
            <li>Texture Caching - Reuses loaded images</li>
            <li>Adaptive Quality - Adjusts detail based on performance</li>
            <li>Low-Res Mode - Optional reduced quality for slower devices</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
            More Information
          </h2>
          <p style={{ color: '#a0a0a0', lineHeight: '1.8' }}>
            For complete API documentation, examples, and advanced usage, see
            the{' '}
            <a
              href="https://github.com/buley/hexgrid-3d"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#667eea' }}
            >
              GitHub repository
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
