import { useTranslation } from 'react-i18next'

// create a custom hook to handle localized labels
export const useLocalizedLabel = () => {
  const { t, i18n } = useTranslation()

  return (key: string) => {
    // if the language is English, return the translation result directly
    if (i18n.language === 'en') {
      return t(key)
    }

    // for other languages, we need to display both the English and translated texts
    // here we use the saveMissing feature of i18next to get the English text
    // if the English resource is not available, only the translated text will be displayed
    const enText = i18n.getFixedT('en')(key)
    const localizedText = t(key)

    // if the English and localized texts are the same, or the English resource is not available, only the localized text will be displayed
    if (enText === localizedText || !enText) {
      return localizedText
    }

    // return the format "English(translated text)"
    return `${enText} (${localizedText})`
  }
}
