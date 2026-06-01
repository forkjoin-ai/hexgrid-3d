declare module 'react' {
  import React from 'react';

  export type RefObject<T> = React.RefObject<T>;
  export const useCallback: typeof React.useCallback;
  export const useEffect: typeof React.useEffect;
  export const useMemo: typeof React.useMemo;
  export const useRef: typeof React.useRef;
  export const useState: typeof React.useState;

  export default React;
}
