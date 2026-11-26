'use client';
import { motion, useReducedMotion } from 'motion/react';
import { DENOMINATION_PALETTE } from '@/domain/denominations';

export default function RewardReveal({ amount }: { amount: number }) {
  const reduceMotion = useReducedMotion();
  if (amount <= 0 || !(amount in DENOMINATION_PALETTE)) return null;
  const palette = DENOMINATION_PALETTE[amount as keyof typeof DENOMINATION_PALETTE];
  return <motion.div
    className="banknote reward-note"
    style={{ '--note-base': palette.base, '--note-text': palette.text, '--note-detail': palette.detail } as React.CSSProperties}
    initial={reduceMotion ? false : { opacity: 0, y: 24, rotate: -3 }}
    animate={{ opacity: 1, y: 0, rotate: 0 }}
    transition={{ duration: reduceMotion ? 0 : 0.35, ease: 'easeOut' }}
    aria-label={`Osvojena virtuelna novčanica ${new Intl.NumberFormat('sr-Latn-RS').format(amount)} RSD`}
  >
    <strong>{new Intl.NumberFormat('sr-Latn-RS').format(amount)} RSD</strong>
    <span>apoen · VIRTUELNO</span>
  </motion.div>;
}
