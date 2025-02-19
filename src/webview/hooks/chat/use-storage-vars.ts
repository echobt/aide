import { useLocalStorage } from 'react-use'

export const useLastDefaultV1PresetName = () =>
  useLocalStorage<string>('lastDefaultV1PresetName')
