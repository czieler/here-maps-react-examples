import { useEffect, useMemo, useRef, useState } from 'react';
import H from '@here/maps-api-for-javascript';
import { useHereMap } from '../../shared/maps/useHereMap';
import styles from './AddressSearchMap.module.css';
import { bubbleAnchorAbovePin, createPinIcon } from '../../shared/maps/pinIcon';

type Position = { lat: number; lng: number };
type Suggestion = { id: string; title: string; address?: { label?: string }; position?: Position; resultType?: string };
type SuggestResponse = { items?: Suggestion[] };
const initial = { lat: 39.7684, lng: -86.1581 };

/** Convert expected HERE/network failures into helpful, user-facing messages. */
function searchError(status: number, service: 'Autosuggest' | 'Lookup'): string {
  if (status === 401 || status === 403) return `HERE ${service} rejected the API key. Check your HERE credentials and service access.`;
  if (status === 429) return `HERE ${service} rate limit reached. Wait a moment and try again.`;
  if (status >= 500) return `HERE ${service} is temporarily unavailable. Please try again.`;
  return `HERE ${service} request failed (HTTP ${status}). Please try again.`;
}

function requestError(cause: unknown): string {
  if (cause instanceof TypeError) return 'Could not connect to HERE. Check your internet connection and try again.';
  return cause instanceof Error ? cause.message : 'Address search failed. Please try again.';
}

/** HERE Geocoding & Search Autosuggest + Lookup, with a map marker for the selected address. */
export function AddressSearchMap({ apiKey }: { apiKey: string }) {
  const { containerRef, map, ui } = useHereMap(apiKey, { center: initial, zoom: 11 });
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const markerRef = useRef<H.map.Marker | null>(null);
  const markerTapRef = useRef<(() => void) | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const sequenceRef = useRef(0);
  const selectionRef = useRef(0);

  // Created once rather than per search: constructing an H.map.Icon from an
  // inline SVG decodes it asynchronously the first time, and building a
  // fresh one on every selection risked that decode racing the pan/zoom this
  // function triggers right after adding the marker.
  const pinIcon = useMemo(() => createPinIcon(), []);

  useEffect(() => {
    if (!map || !ui) return;
    return () => {
      if (markerRef.current && markerTapRef.current) markerRef.current.removeEventListener('tap', markerTapRef.current);
      ui.getBubbles().forEach((bubble) => ui.removeBubble(bubble));
      if (markerRef.current) map.removeObject(markerRef.current);
      markerRef.current = null;
      markerTapRef.current = null;
    };
  }, [map, ui]);

  // Whether the current query/open state is one a search applies to. Items
  // and the busy indicator are gated by this when rendered (below) instead
  // of being reset by the effect, so there's no synchronous setState here.
  const canSearch = query.trim().length >= 3 && open;

  useEffect(() => {
    const value = query.trim();
    requestRef.current?.abort();
    const sequence = ++sequenceRef.current;
    if (value.length < 3 || !open) {
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    const timer = window.setTimeout(async () => {
      setBusy(true);
      setError('');
      try {
        const params = new URLSearchParams({ q: value, at: `${map?.getCenter().lat ?? initial.lat},${map?.getCenter().lng ?? initial.lng}`, limit: '6', apiKey });
        const response = await fetch(`https://autosuggest.search.hereapi.com/v1/autosuggest?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error(searchError(response.status, 'Autosuggest'));
        const data = (await response.json()) as SuggestResponse;
        if (sequence !== sequenceRef.current) return;
        // Filter out category/query suggestions that cannot be resolved to a single location.
        setItems((data.items ?? []).filter((item) => item.position || (item.id && (item.resultType === 'place' || item.resultType === 'address' || item.resultType === 'houseNumber'))));
        setActiveIndex(-1);
      } catch (cause) {
        if (controller.signal.aborted || sequence !== sequenceRef.current) return;
        setError(requestError(cause));
        setItems([]);
      } finally {
        if (sequence === sequenceRef.current) setBusy(false);
      }
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, apiKey, open, map, retryCount]);

  async function choose(item: Suggestion) {
    const selection = ++selectionRef.current;
    sequenceRef.current++;
    requestRef.current?.abort();
    setOpen(false);
    setItems([]);
    setError('');
    setQuery(item.address?.label || item.title);
    setSelectedLabel(item.address?.label || item.title);
    try {
      let position = item.position;
      if (!position) {
        const params = new URLSearchParams({ id: item.id, apiKey });
        const response = await fetch(`https://lookup.search.hereapi.com/v1/lookup?${params}`);
        if (!response.ok) throw new Error(searchError(response.status, 'Lookup'));
        const detail = (await response.json()) as { position?: Position };
        position = detail.position;
      }
      if (selection !== selectionRef.current) return;
      if (!position || !map || !ui) throw new Error('No coordinates were returned for that address.');
      if (markerRef.current && markerTapRef.current) markerRef.current.removeEventListener('tap', markerTapRef.current);
      ui.getBubbles().forEach((bubble) => ui.removeBubble(bubble));
      if (markerRef.current) map.removeObject(markerRef.current);
      const marker = new H.map.Marker(position, { icon: pinIcon, data: null });
      const label = item.address?.label || item.title;
      const markerPosition = position;
      const openBubble = () => {
        ui.getBubbles().forEach((bubble) => ui.removeBubble(bubble));
        const content = document.createElement('div');
        content.style.cssText = 'min-width:180px;max-width:270px;padding:4px;line-height:1.5';
        const heading = document.createElement('strong');
        heading.textContent = item.title;
        content.appendChild(heading);
        if (label !== item.title) {
          const address = document.createElement('div');
          address.textContent = label;
          content.appendChild(address);
        }
        const bubble = new H.ui.InfoBubble(bubbleAnchorAbovePin(map, markerPosition), { content });
        ui.addBubble(bubble);
      };
      marker.addEventListener('tap', openBubble);
      markerTapRef.current = openBubble;
      map.addObject(marker);
      markerRef.current = marker;
      // A single setLookAtData animates center and zoom together. Calling
      // setCenter and setZoom separately starts two concurrent animations
      // that can fight each other on a large jump (e.g. the very first
      // search, moving from the default view to wherever was searched) —
      // that's what was leaving the marker off-screen, not a render timing
      // issue: diagnostics showed it was present and visible, just projected
      // outside the viewport because the camera never actually settled there.
      map.getViewModel().setLookAtData({ position, zoom: 16 }, true);
    } catch (cause) {
      if (selection === selectionRef.current) setError(requestError(cause));
    }
  }

  return <div className={styles.layout}>
    <div className={styles.searchPanel}>
      <label htmlFor="here-address-search">Search for an address</label>
      <div className={styles.searchWrap}>
        <input id="here-address-search" type="text" role="combobox" aria-autocomplete="list" aria-expanded={canSearch && items.length > 0} aria-controls="here-address-options" aria-activedescendant={activeIndex >= 0 ? `here-address-${activeIndex}` : undefined} placeholder="Start typing an address…" autoComplete="off" value={query} onChange={(event) => { selectionRef.current++; setQuery(event.target.value); setSelectedLabel(''); setOpen(true); }} onFocus={() => { if (query.trim().length >= 3 && !selectedLabel) setOpen(true); }} onKeyDown={(event) => {
          if (event.key === 'Escape') { setOpen(false); setActiveIndex(-1); }
          if (!canSearch || !items.length) return;
          if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((index) => (index + 1) % items.length); }
          if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => index <= 0 ? items.length - 1 : index - 1); }
          if (event.key === 'Enter' && activeIndex >= 0) { event.preventDefault(); void choose(items[activeIndex]); }
        }} />
        {query && <button type="button" className={styles.clearButton} aria-label="Clear address search" title="Clear address search" onClick={() => {
          sequenceRef.current++;
          selectionRef.current++;
          requestRef.current?.abort();
          setQuery(''); setSelectedLabel(''); setItems([]); setError(''); setOpen(false); setBusy(false); setActiveIndex(-1);
          if (markerRef.current && markerTapRef.current) markerRef.current.removeEventListener('tap', markerTapRef.current);
          if (markerRef.current && map) map.removeObject(markerRef.current);
          markerRef.current = null; markerTapRef.current = null;
          ui?.getBubbles().forEach((bubble) => ui.removeBubble(bubble));
        }}>×</button>}
        {canSearch && busy && <span className={styles.loading}>Searching…</span>}
        {canSearch && items.length > 0 && <ul id="here-address-options" className={styles.results} role="listbox">
          {items.map((item, index) => <li id={`here-address-${index}`} key={`${item.id}-${index}`} role="option" aria-selected={activeIndex === index}>
            <button type="button" className={activeIndex === index ? styles.active : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => void choose(item)}><strong>{item.title}</strong>{item.address?.label && item.address.label !== item.title && <small>{item.address.label}</small>}</button>
          </li>)}
        </ul>}
      </div>
      {error && <div className={styles.errorRow} role="alert"><p className={styles.error}>{error}</p><button type="button" className={styles.retryButton} onClick={() => { setError(''); setOpen(true); setRetryCount((count) => count + 1); }}>Retry search</button></div>}
      {!error && <p className={styles.hint} aria-live="polite">{selectedLabel ? `Showing: ${selectedLabel}` : 'Select a suggestion to drop a pin and zoom in.'}</p>}
    </div>
    <div className={styles.mapArea} ref={containerRef} aria-label="HERE map showing the selected address" />
  </div>;
}
