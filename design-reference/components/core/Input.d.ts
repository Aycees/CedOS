import * as React from 'react';
/**
 * Text input. boxed for forms/search (mono, bordered box); ghost for titles typed directly onto the
 * page background (borderless, large serif — used for note/event titles).
 * @startingPoint section="Components" subtitle="Boxed (forms) and ghost (inline titles) variants" viewport="360x120"
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'boxed' | 'ghost';
}
export declare function Input(props: InputProps): JSX.Element;
