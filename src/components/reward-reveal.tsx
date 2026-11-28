'use client';
import { motion, useReducedMotion } from 'motion/react';
import { DENOMINATION_PALETTE } from '@/domain/denominations';

export default function RewardReveal({ amount, count = 1 }: { amount: number; count?: number }) {
  const reduceMotion = useReducedMotion();
  if (amount <= 0 || !(amount in DENOMINATION_PALETTE)) return null;
  const palette = DENOMINATION_PALETTE[amount as keyof typeof DENOMINATION_PALETTE];
  return <div className="reward-notes">{Array.from({ length: Math.max(1, Math.min(count, 2)) }, (_, index) => <motion.div
    key={index}
    className="banknote reward-note"
    style={{ '--note-base': palette.base, '--note-text': palette.text, '--note-detail': palette.detail } as React.CSSProperties}
    initial={reduceMotion ? false : { opacity: 0, y: 24, rotate: index ? 3 : -3 }}
    animate={{ opacity: 1, y: 0, rotate: index ? 3 : 0 }}
    transition={{ duration: reduceMotion ? 0 : 0.35, delay: reduceMotion ? 0 : index * 0.1, ease: 'easeOut' }}
    aria-label={`${new Intl.NumberFormat('sr-Latn-RS').format(amount)} RSD · novčanica ${index + 1} od ${count}`}
  >
    <strong>{new Intl.NumberFormat('sr-Latn-RS').format(amount)} RSD</strong>
    <span>apoen · VIRTUELNO</span>
  </motion.div>)}</div>;
}
