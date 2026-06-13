import Link from 'next/link';

export const metadata = {
  title: 'Examples - HexGrid 3D',
  description: 'Example implementations of HexGrid 3D',
};

export default function ExamplesPage() {
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

      <h1 style={{ fontSize: '3rem',  marginBottom: '1rem' }}>Examples</h1>
      <p style={{ color: '#a0a0a0',  marginBottom: '3rem',  fontSize: '1.2rem' }}>
        See HexGrid 3D in action with these example implementations
      </p>

      <div style={{ display: 'grid',  gap: '2rem' }}>
        <section>
          <h2 style={{ fontSize: '2rem',  marginBottom: '1rem' }}>
            Basic Example
          </h2>
          <div className="code-block">
            <code>
              {`import { HexGrid, Photo } from '@buley/hexgrid-3d'

function BasicExample(: unknown) {
  const photos: Photo[] = [
    {
      id: '1',
      url: 'https://example.com/photo1.jpg',
      source: 'example',
      createdAt: new Date().toISOString()
    },
    {
      id: '2',
      url: 'https://example.com/photo2.jpg',
      source: 'example',
      createdAt: new Date().toISOString()
    }
  ]

  return (
    <HexGrid
      photos={photos}
      onHexClick={(photo) => {
        console.log('Selected photo:', photo)
      }}
    />
  )
}`}
            </code>
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
            Advanced Example with Controls
          </h2>
          <div className="code-block">
            <code>
              {`import { HexGrid, Photo, uiStore } from '@buley/hexgrid-3d'
import { useRef, useState } from '@a0n/raect'

function AdvancedExample() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div>
      {/* Control buttons */}
      <button onClick={() => uiStore.toggleDebug()}>
        Toggle Debug
      </button>
      <button onClick={() => uiStore.toggleCamera()}>
        Camera Controls
      </button>

      {/* Visualization */}
      <HexGrid
        photos={photos}
        canvasRef={canvasRef}
        spacing={1.2}
        modalOpen={modalOpen}
        onHexClick={(photo) => setModalOpen(true)}
        autoplayQueueLimit={100}
      />
    </div>
  )
}`}
            </code>
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
            With Custom Theming
          </h2>
          <div className="code-block">
            <code>
              {`import { HexGrid, Photo } from '@buley/hexgrid-3d'
import { setCustomAccentColor } from '@/lib/theme-colors'

function ThemedExample() {
  // Set custom accent color
  setCustomAccentColor('#ff00ff')

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
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
            More Examples
          </h2>
          <p style={{ color: '#a0a0a0', lineHeight: '1.8' }}>
            For more examples and use cases, check out the{' '}
            <a
              href="https://github.com/buley/hexgrid-3d/tree/main/examples"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#667eea' }}
            >
              examples directory
            </a>{' '}
            in the GitHub repository.
          </p>
        </section>
      </div>
    </div>
  );
}
