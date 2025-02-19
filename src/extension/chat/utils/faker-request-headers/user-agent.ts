export const generateRandomChromeUserAgent = () => {
  const chromeVersions = [
    '90',
    '91',
    '92',
    '93',
    '94',
    '95',
    '96',
    '97',
    '98',
    '99',
    '100',
    '101',
    '102',
    '103',
    '104',
    '105'
  ]
  const osVersions = ['10.0', '11.0']

  const chromeVersion =
    chromeVersions[Math.floor(Math.random() * chromeVersions.length)]
  const osVersion = osVersions[Math.floor(Math.random() * osVersions.length)]

  return `Mozilla/5.0 (Windows NT ${osVersion}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.${Math.floor(Math.random() * 9999)}.0 Safari/537.36`
}
