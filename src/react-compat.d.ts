declare namespace React {
  type ReactNode = import('react').ReactNode;
  type ChangeEvent<T = Element> = import('react').ChangeEvent<T>;
}

declare module 'react' {
  interface Component<P = {}, S = {}, SS = any> {
    readonly props: P;
  }
}
