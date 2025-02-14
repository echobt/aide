import type { ComponentProps, JSX } from 'react'
import type { Element } from 'hast'

export interface BaseMDElementProps {
  node?: Element
}

export interface BaseCustomElementProperties {
  isblockclosed: string
  encodedcontent?: string
}

export interface BaseCustomElementProps<
  ElementProperties extends Record<string, string> = {}
> extends BaseMDElementProps {
  node: Omit<Element, 'properties'> & {
    properties: ElementProperties & BaseCustomElementProperties
  }
}

export type MDElementProps<T extends keyof JSX.IntrinsicElements> =
  ComponentProps<T> & BaseMDElementProps
