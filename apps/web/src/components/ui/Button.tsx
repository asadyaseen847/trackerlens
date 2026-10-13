import type { ComponentPropsWithRef } from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  /** "primary" is the lime button: only one lime element per screen (§12). */
  variant?: 'default' | 'primary' | 'dark' | 'danger';
}

export function Button({ variant = 'default', className, type = 'button', ...rest }: ButtonProps) {
  const classes = [styles.btn, variant !== 'default' && styles[variant], className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={classes} {...rest} />;
}
