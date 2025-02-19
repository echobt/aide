import crypto from 'crypto'

export const generateRandomDomain = () => {
  const tlds = ['com', 'org', 'net', 'io', 'co', 'us', 'ru', 'de', 'uk']
  const domain = crypto.randomBytes(8).toString('hex')
  const tld = tlds[Math.floor(Math.random() * tlds.length)]
  return `${domain}.${tld}`
}
