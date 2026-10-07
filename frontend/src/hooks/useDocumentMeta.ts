import { useEffect } from 'react';

/** SEO por página: title, description, canonical e Open Graph. */
export function useDocumentMeta({ title, description, noindex }: { title: string; description?: string; noindex?: boolean }) {
  useEffect(() => {
    document.title = title;
    const set = (selector: string, attr: string, key: string, value: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', value);
    };
    set('meta[property="og:title"]', 'property', 'og:title', title);
    if (description) {
      set('meta[name="description"]', 'name', 'description', description);
      set('meta[property="og:description"]', 'property', 'og:description', description);
    }
    set('meta[name="robots"]', 'name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) canonical.href = window.location.origin + window.location.pathname;
  }, [title, description, noindex]);
}
