export const generateRandomIP = () =>
  Array(4)
    .fill(0)
    .map(() => Math.floor(Math.random() * 256))
    .join('.')
