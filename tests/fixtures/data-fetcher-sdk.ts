export const fetchResourceURL = async (url: string) => url;
export const message = {
  errors: [] as string[],
  error(value: string) {
    this.errors.push(value);
  },
};
