declare module 'next' {
  export interface Metadata {
    readonly title?: string;
    readonly description?: string;
    readonly keywords?: readonly string[];
    readonly authors?: readonly { readonly name: string }[];
    readonly openGraph?: {
      readonly title?: string;
      readonly description?: string;
      readonly type?: string;
    };
  }
}

declare module 'next/font/google' {
  export function Inter(options: { readonly subsets?: readonly string[] }): {
    readonly className: string;
  };
}

declare module 'next/link' {
  import type { AnchorHTMLAttributes, ReactNode } from 'react';

  export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
    readonly href: string;
    readonly children?: ReactNode;
  }

  export default function Link(props: LinkProps): JSX.Element;
}
