'use client';

import { motion } from 'framer-motion';
import { ComponentProps } from 'react';

type MotionDivProps = ComponentProps<typeof motion.div>;

export const MotionDiv = ({ children, ...props }: MotionDivProps) => (
  <motion.div {...props}>
    {children}
  </motion.div>
);
