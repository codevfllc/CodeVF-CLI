declare module 'ink-testing-library' {
  import type { ReactElement } from 'react';

  interface Stdin {
    write: (_data: string) => void;
  }

  interface Stdout {
    write: (_data: string) => void;
  }

  interface RenderResult {
    stdin: Stdin;
    stdout: Stdout;
    lastFrame: () => string | undefined;
    frames: string[];
    rerender: (_tree: ReactElement) => void;
    unmount: () => void;
    cleanup: () => void;
  }

  export function render(_tree: ReactElement): RenderResult;
}
