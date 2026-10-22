import { useEffect, useState } from 'react';
import { BasicMap } from './examples/basic/BasicMap';
import { RestaurantMap } from './examples/clustering/RestaurantMap';
import { InfoBubbleMap } from './examples/marker/InfoBubbleMap';
import { AddressSearchMap } from './examples/marker/AddressSearchMap';
import { RouteMap } from './examples/directions/RouteMap';
import { BridgeTileOverlayMap } from './examples/tile-overlay/BridgeTileOverlayMap';
import { Sidebar } from './components/layout/Sidebar';
import { CodeSample } from './components/layout/CodeSample';
import { examples, type ExampleId } from './docs/examples';
import styles from './App.module.css';
function currentExample(): ExampleId { const id = window.location.hash.replace(/^#\/?/, ''); return id === 'basic' || id === 'route' || id === 'clusters' || id === 'marker' || id === 'search' || id === 'bridges' ? id : 'clusters'; }
export default function App() {
  const apiKey = import.meta.env.VITE_HERE_API_KEY;
  const [selected, setSelected] = useState<ExampleId>(currentExample);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { const onHashChange = () => setSelected(currentExample()); window.addEventListener('hashchange', onHashChange); return () => window.removeEventListener('hashchange', onHashChange); }, []);
  const example = examples.find((item) => item.id === selected) ?? examples[0];
  return <div className={styles.shell}>
    <Sidebar selected={selected} onSelect={setSelected} open={menuOpen} onClose={() => setMenuOpen(false)} />
    <main className={styles.main}>
      <header className={styles.topbar}><button className={styles.menu} onClick={() => setMenuOpen(true)} aria-label="Open examples menu">☰</button><span>HERE Maps / Examples / {example.title}</span><span className={styles.mode}>● Live API</span></header>
      <div className={styles.content}>
        <p className={styles.eyebrow}>{example.category} / EXAMPLE</p><h1>{example.title}</h1><p className={styles.lead}>{example.summary}</p>
        <section className={styles.demoSection}><div className={styles.demoHeader}><strong>Interactive demo</strong><span>HERE Maps API for JavaScript</span></div><div className={styles.demo}>{!apiKey ? <div className={styles.noKey}><strong>HERE API key required to display the map</strong><p>Copy <code>.env.example</code> to <code>.env.local</code> and set <code>VITE_HERE_API_KEY</code>. All examples use live services and require appropriate API access.</p></div> : selected === 'basic' ? <BasicMap apiKey={apiKey} /> : selected === 'clusters' ? <RestaurantMap apiKey={apiKey} /> : selected === 'marker' ? <InfoBubbleMap apiKey={apiKey} /> : selected === 'search' ? <AddressSearchMap apiKey={apiKey} /> : selected === 'bridges' ? <BridgeTileOverlayMap apiKey={apiKey} /> : <RouteMap apiKey={apiKey} />}</div></section>
        <div className={styles.details}><section><h2>How it works</h2>{example.details.map((line) => <p key={line}>{line}</p>)}</section><aside className={styles.features}><h3>Features used</h3>{example.features.map((feature) => <span key={feature}>{feature}</span>)}<p>Uses live services; requests may count toward API usage.</p></aside></div>
        <section className={styles.codeSection}><h2>React / TypeScript example</h2><p>Selected implementation excerpt. Browse the source files for the full working example.</p><CodeSample code={example.snippet} /></section>
      </div>
    </main>
  </div>;
}
