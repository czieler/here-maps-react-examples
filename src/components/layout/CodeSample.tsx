import { useState } from 'react';
import styles from './CodeSample.module.css';
export function CodeSample({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() { try { await navigator.clipboard.writeText(code); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); } }
  return <section className={styles.wrapper} aria-label="TypeScript code example"><div className={styles.bar}><span>TypeScript / TSX</span><button onClick={() => void copy()}>{copied ? 'Copied!' : 'Copy code'}</button></div><pre><code>{code}</code></pre></section>;
}
