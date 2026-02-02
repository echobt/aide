import { Component, JSX, splitProps } from "solid-js";

// Simple HTML sanitizer - removes dangerous patterns
function sanitizeHTML(html: string): string {
  // Remove script tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove on* event handlers
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]+/gi, '');
  
  // Remove javascript: and vbscript: URLs
  sanitized = sanitized.replace(/href\s*=\s*["']?\s*javascript:[^"'>]*/gi, 'href="#"');
  sanitized = sanitized.replace(/src\s*=\s*["']?\s*javascript:[^"'>]*/gi, 'src=""');
  
  // Remove data: URLs except for images
  sanitized = sanitized.replace(/(?:href|src)\s*=\s*["']?\s*data:(?!image\/)[^"'>]*/gi, '');
  
  // Remove iframe, embed, object tags
  sanitized = sanitized.replace(/<(iframe|embed|object)\b[^>]*>.*?<\/\1>/gi, '');
  sanitized = sanitized.replace(/<(iframe|embed|object)\b[^>]*\/?>/gi, '');
  
  // Remove style tags (can contain expressions)
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove expression() from inline styles
  sanitized = sanitized.replace(/expression\s*\([^)]*\)/gi, '');
  
  return sanitized;
}

export interface SafeHTMLProps extends JSX.HTMLAttributes<HTMLDivElement> {
  html: string;
  tag?: 'div' | 'span' | 'p';
}

export const SafeHTML: Component<SafeHTMLProps> = (props) => {
  const [local, others] = splitProps(props, ['html', 'tag']);
  const Tag = local.tag || 'div';
  
  return (
    <Tag 
      {...others}
      innerHTML={sanitizeHTML(local.html)} 
    />
  );
};

export default SafeHTML;
