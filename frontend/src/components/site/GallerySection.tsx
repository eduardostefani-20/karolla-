import { siteContent } from '@/data/content';
import { PetIllustration } from './PetIllustration';
import { Section } from './Section';

const backgrounds = ['bg-brand-100', 'bg-coral-100', 'bg-sun-100', 'bg-brand-200/60', 'bg-coral-50', 'bg-brand-50'];

export function GallerySection() {
  return (
    <Section id="galeria" eyebrow="Galeria" title="Clientes de quatro patas" className="bg-white">
      <ul className="scroll-thin -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-6">
        {siteContent.gallery.map((item, i) => (
          <li key={item.caption} className="w-[62%] shrink-0 snap-center sm:w-auto">
            <figure className={`overflow-hidden rounded-3xl ${backgrounds[i % backgrounds.length]}`}>
              {item.photo ? (
                <img src={item.photo} alt={item.caption} loading="lazy" decoding="async" className="aspect-[4/5] w-full object-cover" />
              ) : (
                <div className="grid aspect-[4/5] place-items-center p-5">
                  <PetIllustration {...item.pet} title={item.caption} className="w-full transition-transform duration-300 hover:scale-105" />
                </div>
              )}
              <figcaption className="bg-white/70 px-4 py-3 text-sm font-semibold text-ink-700">{item.caption}</figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </Section>
  );
}
