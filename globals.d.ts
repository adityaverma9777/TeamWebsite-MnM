declare module 'react' {
  export = React;
  export as namespace React;
  namespace React {
    type ReactNode = any;
    type FC<P = {}> = any;
    function useRef<T = any>(initialValue?: T): { current: T };
    function useState<T = any>(initialState?: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
    function useEffect(effect: () => void | (() => void), deps?: any[]): void;
    function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
    function useMemo<T>(factory: () => T, deps?: any[]): T;
  }
}
declare module 'react-dom';
declare module 'react-dom/client';
declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}
declare module 'three' {
  const all: any;
  export = all;
}
declare module 'three/examples/jsm/geometries/RoundedBoxGeometry.js' {
  export class RoundedBoxGeometry {
    constructor(...args: any[]);
  }
}
declare module 'three/examples/jsm/math/MeshSurfaceSampler.js' {
  export class MeshSurfaceSampler {
    constructor(...args: any[]);
    build(): this;
    sample(targetPosition: any, targetNormal: any): void;
  }
}
declare module 'three/examples/jsm/utils/BufferGeometryUtils.js' {
  export function mergeVertices(geometry: any, tolerance?: number): any;
}
declare module '@/components/ui/fuzzy-critter-footer' {
  const component: any;
  export default component;
}
declare module '@/components/ui/doodle-crew-footer' {
  const component: any;
  export default component;
}
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
