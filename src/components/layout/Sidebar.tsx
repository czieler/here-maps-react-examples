import { examples, type ExampleId } from '../../docs/examples';
import styles from './Sidebar.module.css';
export function Sidebar({ selected, onSelect, open, onClose }: { selected: ExampleId; onSelect: (id: ExampleId) => void; open: boolean; onClose: () => void }) {
  const categories = [...new Set(examples.map((item) => item.category))];
  return <aside className={`${styles.sidebar} ${open ? styles.open : ''}`} aria-label="Examples navigation">
    <div className={styles.brand}><span className={styles.brandIcon}>H</span><div><strong>HERE Maps</strong><small>React examples</small></div><button className={styles.close} onClick={onClose} aria-label="Close navigation">×</button></div>
    <div className={styles.navLabel}>EXAMPLES</div>
    {categories.map((category) => <div key={category} className={styles.group}><p>{category}</p>{examples.filter((item) => item.category === category).map((item) => <a key={item.id} href={`#/${item.id}`} aria-current={selected === item.id ? 'page' : undefined} className={selected === item.id ? styles.selected : ''} onClick={() => { onSelect(item.id); onClose(); }}>{item.title}<span aria-hidden="true">›</span></a>)}</div>)}
    <div className={styles.footer}>React · TypeScript · HERE SDK</div>
  </aside>;
}
