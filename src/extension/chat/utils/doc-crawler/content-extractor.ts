/* eslint-disable func-names */
import * as cheerio from 'cheerio'
import type { Element } from 'domhandler'
import TurndownService from 'turndown'

export class ContentExtractor {
  private turndownService: TurndownService

  constructor() {
    this.turndownService = new TurndownService()
  }

  extract($: cheerio.CheerioAPI, selectors: string[]): string {
    const mainContent = this.findMainContent($, selectors)
    this.cleanupContent($, mainContent)
    return this.convertToMarkdown(mainContent)
  }

  private findMainContent(
    $: cheerio.CheerioAPI,
    selectors: string[]
  ): cheerio.Cheerio<Element> {
    const userSelectors = selectors.join(', ')
    let content = $<Element, string>(userSelectors)

    if (content.length === 0) {
      content = this.detectMainContent($)
    }

    return content
  }

  private detectMainContent($: cheerio.CheerioAPI): cheerio.Cheerio<Element> {
    let maxContent = $('body')
    let maxLength = 0

    $('div, section').each((_, elem) => {
      const textLength = $(elem).text().trim().length
      if (textLength > maxLength) {
        maxLength = textLength
        maxContent = $(elem)
      }
    })

    return maxContent
  }

  private cleanupContent(
    $: cheerio.CheerioAPI,
    content: cheerio.Cheerio<Element>
  ): void {
    // Remove unwanted elements
    content
      .find('script, style, noscript, iframe, img, svg, header, footer, nav')
      .remove()

    // Remove empty paragraphs and divs
    content
      .find('p, div')
      .filter((_, elem) => $(elem).text().trim() === '')
      .remove()

    // Remove attributes
    content.find('*').each((_, elem) => {
      $(elem).removeAttr('class').removeAttr('id')
    })
  }

  private convertToMarkdown(content: cheerio.Cheerio<Element>): string {
    const html = content.html()
    if (!html) return ''

    return this.turndownService.turndown(html)
  }
}
