// Local persistence must work without contacting the private annotation service.
globalThis.fetch = async (url) => {
  throw new Error(`Unexpected network request from a local operation: ${url}`);
};

export {};
