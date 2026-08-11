import * as React from 'react';
/**
 * Centered overlay dialog for create/edit forms (events, transactions, habits, credentials).
 * @startingPoint section="Components" subtitle="Centered dialog with dark overlay" viewport="400x260"
 */
export interface ModalProps {
  children: React.ReactNode;
  width?: number;
  onClose?: () => void;
}
export declare function Modal(props: ModalProps): JSX.Element;
