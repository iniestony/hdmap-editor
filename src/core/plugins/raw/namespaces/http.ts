import { ExtendedNamespace } from '../../../types/plugins/raw';
import { createRawHttpRequest, createRawGetUrl, createRawHttpRequestWithBody } from '../../../utils/http';

export async function createHttpRequest(
  this: ExtendedNamespace,
  options: {
    method: 'get' | 'post' | 'delete',
    ns: string,
    payload?: Object,
  },
) {
  return createRawHttpRequest({
    method: options.method,
    ns: options.ns,
    payload: options.payload,
  });
};

export function createGetUrl(
  this: ExtendedNamespace,
  options: {
    ns: string,
    payload?: Object,
  },
) {
  return createRawGetUrl({
    ns: options.ns,
    payload: options.payload,
  });
};

export async function createHttpRequestWithBody(
  this: ExtendedNamespace,
  options: {
    method: 'get' | 'post' | 'delete',
    ns: string,
    body: Object,
  },
) {
  return createRawHttpRequestWithBody({
    method: options.method,
    ns: options.ns,
    body: options.body,
  });
};
