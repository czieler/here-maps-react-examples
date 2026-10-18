import { useHereMap } from '../../shared/maps/useHereMap';
import styles from './BasicMap.module.css';
const configuration = { center: { lat: 39.7684, lng: -86.1581 }, zoom: 9 };
export function BasicMap({ apiKey }: { apiKey: string }) { const { containerRef } = useHereMap(apiKey, configuration); return <div className={styles.map} ref={containerRef} aria-label="Interactive basic HERE map" />; }
