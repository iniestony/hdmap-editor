import axios from 'axios';

const prefix = `http://192.168.16.86:9900/`;

export async function createRawHttpRequest(
  options: {
    method: 'get' | 'post' | 'delete',
    ns: string,
    payload?: Object,
  },
) {
  const params = options.payload || {};

  return new Promise(async (resolve) => {
    try {
      const response = await axios({
        method: options.method,
        url: `${prefix}${options.ns}`,
        params,
      });

      if (response?.data) {
        resolve({
          isSuccess: true,
          data: response.data,
        });
      } else {
        resolve({
          isSuccess: false,
        });
      }
    } catch (error) {
      resolve({
        isSuccess: false,
      });
    }
  });
};

export function createRawGetUrl(
  options: {
    ns: string,
    payload?: Object,
  },
) {
  let params = '';

  if (options.payload) {
    const payload = options.payload as { [key: string]: any };

    const keys = Object.keys(payload);
    const pairs = keys.map((key: string) => {
      return `${key}=${payload[key]}`;
    });

    params = pairs.join('&');
  }

  return `${prefix}${options.ns}?${params}`;
};

export async function createRawHttpRequestWithBody(
  options: {
    method: 'get' | 'post' | 'delete',
    ns: string,
    body: Object,
  },
) {
  return new Promise(async (resolve) => {
    try {
      const response = await axios({
        headers: {
          'Content-Type': 'application/json;'
        },
        method: options.method,
        url: `${prefix}${options.ns}`,
        data: JSON.stringify(options.body),
      });

      if (response?.data) {
        resolve({
          isSuccess: true,
          data: response.data,
        });
      } else {
        resolve({
          isSuccess: false,
        });
      }
    } catch (error) {
      resolve({
        isSuccess: false,
      });
    }
  });
};
