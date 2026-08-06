/// <reference types="vite/client" />

// CSS dosyalarını modül olarak tanımla
declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

