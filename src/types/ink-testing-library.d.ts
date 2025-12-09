declare module 'ink-testing-library' {
  import type { ReactElement } from 'react';

  interface Stdin {
    write: (data: string) => void;
  }

  interface Stdout {
    write: (data: string) => void;
  }

  interface RenderResult {
    stdin: Stdin;
    stdout: Stdout;
    lastFrame: () => string | undefined;
    frames: string[];
    rerender: (tree: ReactElement) => void;
    unmount: () => void;
    cleanup: () => void;
  }

  export function render(tree: ReactElement): RenderResult;
}
