import { AxiosError } from 'axios';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';

// TOS still imports the factory removed in axios 0.27. Keep its argument order
// while using the maintained public error type.
export default function createError(
  message: string,
  config: AxiosRequestConfig,
  code?: string | null,
  request?: unknown,
  response?: AxiosResponse,
) {
  return new AxiosError(message, code || undefined, config, request, response);
}
