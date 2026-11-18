import 'i18next';

declare module 'i18next' {
  // Preserve the original project's string-only translation calls without shadowing the i18next module.
  interface TFunction {
    (key: string | string[], options?: Record<string, any> | string): string;
  }
}
