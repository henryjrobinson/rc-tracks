import { loadTracks } from '@/lib/tracks';
import { TrackBrowser } from './track-browser';

export default async function Home() {
  const tracks = await loadTracks();
  const usable = tracks.filter((t) => !t.fetchError);
  return (
    <main className="page">
      <header className="header">
        <h1>RC Tracks</h1>
        <p className="sub">
          {usable.length.toLocaleString()} RC racing tracks worldwide, scraped from{' '}
          <a href="https://liverc.com" target="_blank" rel="noreferrer">LiveRC</a>.
        </p>
      </header>

      <TrackBrowser tracks={usable} />

      <footer>
        Data scraped weekly from <a href="https://live.liverc.com/" target="_blank" rel="noreferrer">live.liverc.com</a>.
        Track listings, addresses, and contact info belong to their respective owners. Geocoding via{' '}
        <a href="https://nominatim.openstreetmap.org/" target="_blank" rel="noreferrer">Nominatim / OpenStreetMap</a>.
      </footer>
    </main>
  );
}
