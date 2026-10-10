import { describe, it, expect } from 'vitest';
import { scoreCandidate, findCheaperAlternatives, buildComparison } from '../src/shared/matching-engine.js';

const source = {
  retailerId: 'amazon',
  title: 'Test Brand Widget X200 (Blue, 128 GB)',
  brand: 'Test Brand',
  model: 'X200',
  gtin: '1234567890123',
  variant: { color: 'Blue', size: '', storage: '128 GB' },
  price: 19999,
  currency: 'INR',
};

describe('scoreCandidate', () => {
  it('confirms an exact GTIN match regardless of title wording', () => {
    const candidate = { title: 'Totally different title', gtin: '1234567890123', price: 18999 };
    const result = scoreCandidate(source, candidate);
    expect(result.confidence).toBe('confirmed');
    expect(result.tier).toBe('gtin');
  });

  it('confirms a brand + model match without a GTIN', () => {
    const candidate = { title: 'Test Brand X200 Smartphone (128GB, Blue)', brand: 'Test Brand', price: 18999 };
    const result = scoreCandidate(source, candidate);
    expect(result.confidence).toBe('confirmed');
    expect(result.tier).toBe('brand+model');
  });

  it('never confirms a different model, even with heavy title overlap', () => {
    const candidate = { title: 'Test Brand Widget X300 (Blue, 128 GB)', brand: 'Test Brand', price: 15999 };
    const result = scoreCandidate(source, candidate);
    expect(result.confidence).not.toBe('confirmed');
  });

  it('rejects an unrelated product', () => {
    const candidate = { title: 'Random Kitchen Blender 500W', brand: 'Other Co', price: 999 };
    const result = scoreCandidate(source, candidate);
    expect(result.confidence).toBe('none');
  });

  it('still surfaces a match as "possible" when a retailer typo breaks the exact model substring', () => {
    // Real-world case found testing against live Amazon.in/Flipkart listings:
    // Flipkart's own title lists this boAt model as "Basshads" (typo) instead
    // of "Bassheads", so the Tier-2 exact substring check can't fire — but the
    // product is still clearly the same item and should be surfaced, not hidden.
    const realSource = {
      brand: 'boAt',
      model: 'Bassheads 102',
      title: 'boAt Bassheads 102 in Ear Wired Earphones with Mic(Charcoal Black)',
      gtin: '',
      variant: { color: '', size: '', storage: '' },
      price: 299,
    };
    const candidate = { title: 'boAt Basshads 102 Wired', price: 884 };
    const result = scoreCandidate(realSource, candidate);
    expect(result.tier).toBe('fuzzy');
    expect(result.confidence).toBe('possible');
  });

  it('rejects a cheaper different-RAM/storage variant of the same phone line, even with no model field', () => {
    // Real-world case: a live Amazon.in search for "Redmi Note 15 SE 5G" returned
    // four listings — same phone line, different RAM/storage/color — that all
    // scored ~identically on plain title overlap (every word matches except the
    // spec numbers). Before this fix, findCheaperAlternatives picked the 6GB-RAM
    // variant at a lower price and reported it as a "possible match, save ₹2,000"
    // against an 8GB-RAM source — a false claim comparing different products.
    const phoneSource = {
      brand: 'Redmi',
      model: '',
      title: 'Redmi Note 15 SE 5G Smartphone, Crimson Reserve, 8GB RAM, 128GB Storage, 5800mAh Battery, IP66 Military Grade',
      gtin: '',
      variant: { color: '', size: '', storage: '' },
      price: 27400,
    };
    const differentRam = {
      title: 'Redmi Note 15 SE 5G Smartphone, Crimson Reserve, 6GB RAM, 128GB, 5800mAh Battery, IP66 Military Grade',
      price: 25400,
    };
    const differentStorage = {
      title: 'Redmi Note 15 SE 5G Smartphone, Crimson Reserve, 8GB RAM, 256GB, 5800mAh Battery, IP66 Military Grade',
      price: 29979,
    };
    const exactVariant = {
      title: 'Redmi Note 15 SE 5G Smartphone, Crimson Reserve, 8GB RAM, 128GB Storage, 5800mAh Battery, IP66 Military Grade',
      price: 27400,
    };

    expect(scoreCandidate(phoneSource, differentRam).confidence).toBe('none');
    expect(scoreCandidate(phoneSource, differentStorage).confidence).toBe('none');
    expect(scoreCandidate(phoneSource, exactVariant).confidence).toBe('possible');

    const results = findCheaperAlternatives(phoneSource, {
      flipkart: [differentRam, differentStorage, exactVariant],
    });
    expect(results).toHaveLength(1);
    expect(results[0].product.price).toBe(27400);
    expect(results[0].isCheaper).toBe(false);
  });

  it('catches a spec conflict hidden in a separate spec-bullet list, not just the title', () => {
    // Real-world case, found by fetching the actual Flipkart listing: its
    // product-card title only says "(Crimson Reserve, 128 GB)" — no RAM
    // figure at all — the "6 GB RAM" only appears in a separate <li> spec
    // list the scraper captures into `candidate.specs`. Two bugs had to be
    // fixed to catch this: (1) the conflict check originally only looked at
    // `candidate.title`, missing `specs` entirely; (2) it tokenized with
    // tokenize() first, which splits "128 GB" (space) into two tokens but
    // leaves "128GB" (no space) as one, so the regex-on-tokens approach
    // silently missed the space-separated form; (3) the real card's title
    // repeats "128 GB" that's *also* restated in the specs bullet
    // ("128 GB ROM"), inflating the raw occurrence count and defeating a
    // naive count-based conflict check — fixed by comparing distinct values
    // per unit rather than raw occurrence counts.
    const phoneSource = {
      brand: 'Redmi',
      model: '',
      title: 'Redmi Note 15 SE 5G Smartphone, Crimson Reserve, 8GB RAM, 128GB Storage, 5800mAh Battery, IP66 Military Grade',
      gtin: '',
      variant: { color: '', size: '', storage: '' },
      price: 27400,
    };
    const wrongRamViaSpecs = {
      title: 'REDMI Note 15 SE 5G Snapdragon (Crimson Reserve, 128 GB)',
      specs: '6 GB RAM | 128 GB ROM | Expandable Upto 1 TB | 17.2 cm (6.77 inch) Full HD+ AMOLED Display | 50MP Rear Camera | 20MP Front Camera | 5800 mAh Lithium-Ion Polymer Battery',
      price: 25999,
    };
    const correctRamViaSpecs = {
      title: 'REDMI Note 15 SE 5G Snapdragon (Crimson Reserve, 128 GB)',
      specs: '8 GB RAM | 128 GB ROM | Expandable Upto 1 TB',
      price: 27999,
    };

    expect(scoreCandidate(phoneSource, wrongRamViaSpecs).confidence).toBe('none');
    expect(scoreCandidate(phoneSource, correctRamViaSpecs).confidence).toBe('possible');
  });
});

describe('findCheaperAlternatives', () => {
  it('reports savings when a confirmed match is cheaper', () => {
    const results = findCheaperAlternatives(source, {
      flipkart: [
        {
          title: 'Test Brand Widget X200 (Blue, 128 GB)',
          brand: 'Test Brand',
          price: 17999,
          url: 'https://www.flipkart.com/p/test',
        },
      ],
    });

    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBe('confirmed');
    expect(results[0].isCheaper).toBe(true);
    expect(results[0].savings).toBe(2000);
  });

  it('omits retailers with no plausible candidate', () => {
    const results = findCheaperAlternatives(source, {
      flipkart: [{ title: 'Random Kitchen Blender 500W', brand: 'Other Co', price: 999 }],
    });
    expect(results).toHaveLength(0);
  });
});

describe('buildComparison', () => {
  // The exact scenario the user described: JBL earphones at ₹1200 (source)
  // vs ₹1250 elsewhere — only ₹50 more, but with meaningfully better,
  // trustworthy reviews — should be called out as the best value, not just
  // silently ranked second by price.
  const jblSource = {
    retailerId: 'amazon',
    brand: 'JBL',
    model: 'Tune 110',
    title: 'JBL Tune 110 Wired in Ear Earphones',
    gtin: '',
    variant: { color: '', size: '', storage: '' },
    price: 1200,
    rating: 3.8,
    ratingCount: 500,
  };

  it('flags a slightly pricier option as best value when its reviews are meaningfully better and trustworthy', () => {
    const betterReviewed = {
      title: 'JBL Tune 110 Wired in Ear Earphones',
      brand: 'JBL',
      price: 1250,
      rating: 4.5,
      ratingCount: 800,
      url: 'https://www.flipkart.com/p/jbl-tune-110',
    };

    const { options, cheapest, bestValue } = buildComparison(jblSource, { flipkart: [betterReviewed] });

    expect(options).toHaveLength(2);
    expect(cheapest.price).toBe(1200);
    expect(cheapest.isCurrent).toBe(true);
    expect(bestValue).not.toBeNull();
    expect(bestValue.price).toBe(1250);
    expect(bestValue.rating).toBe(4.5);
  });

  it('does not flag a pricier option as best value when the price gap is large', () => {
    const pricierButBetterReviewed = {
      title: 'JBL Tune 110 Wired in Ear Earphones',
      brand: 'JBL',
      price: 1600, // well outside the "not much difference" threshold
      rating: 4.8,
      ratingCount: 2000,
      url: 'https://www.flipkart.com/p/jbl-tune-110-premium',
    };

    const { bestValue } = buildComparison(jblSource, { flipkart: [pricierButBetterReviewed] });
    expect(bestValue).toBeNull();
  });

  it('does not flag a near-priced option as best value when its rating is only marginally better', () => {
    const barelyBetterRated = {
      title: 'JBL Tune 110 Wired in Ear Earphones',
      brand: 'JBL',
      price: 1230,
      rating: 3.9, // only +0.1 over source's 3.8, below the 0.2 edge required
      ratingCount: 500,
      url: 'https://www.flipkart.com/p/jbl-tune-110-b',
    };

    const { bestValue } = buildComparison(jblSource, { flipkart: [barelyBetterRated] });
    expect(bestValue).toBeNull();
  });

  it('does not flag an option with too few ratings to trust, even if the score looks great', () => {
    const fewRatings = {
      title: 'JBL Tune 110 Wired in Ear Earphones',
      brand: 'JBL',
      price: 1220,
      rating: 5.0,
      ratingCount: 3, // below the trust threshold
      url: 'https://www.flipkart.com/p/jbl-tune-110-new',
    };

    const { bestValue } = buildComparison(jblSource, { flipkart: [fewRatings] });
    expect(bestValue).toBeNull();
  });

  it('returns a null bestValue (cheapest is already best) when nothing beats it on rating', () => {
    // Source priced well outside the "near cheapest" threshold here (unlike
    // the shared jblSource used above) so this test isn't accidentally
    // testing the "flag the source as best value" case instead.
    const farSource = { ...jblSource, price: 1800, rating: 4.2, ratingCount: 1000 };
    const cheaperAndWorseRated = {
      title: 'JBL Tune 110 Wired in Ear Earphones',
      brand: 'JBL',
      price: 1100,
      rating: 3.5,
      ratingCount: 200,
      url: 'https://www.flipkart.com/p/jbl-tune-110-cheap',
    };

    const { cheapest, bestValue } = buildComparison(farSource, { flipkart: [cheaperAndWorseRated] });
    expect(cheapest.price).toBe(1100);
    expect(bestValue).toBeNull();
  });
});

// Non-electronics categories: beauty/grocery quantities and multipacks.
describe('spec conflicts outside electronics', () => {
  const lotion = {
    retailerId: 'amazon',
    title: 'Nivea Soft Moisturising Cream 100 g',
    brand: 'Nivea',
    model: '',
    gtin: '',
    variant: { color: '', size: '', storage: '' },
    price: 250,
  };

  it('rejects the same product line in a different gram size', () => {
    const bigger = { title: 'Nivea Soft Moisturising Cream 200 g', brand: 'Nivea', price: 400 };
    expect(scoreCandidate(lotion, bigger).tier).toBe('spec-conflict');
  });

  it('treats "100 gm" and "100 g" as the same quantity', () => {
    const same = { title: 'Nivea Soft Moisturising Cream 100 gm', brand: 'Nivea', price: 230 };
    expect(scoreCandidate(lotion, same).confidence).toBe('possible');
  });

  it('rejects a different multipack size and different volume units', () => {
    const shampoo = { ...lotion, title: 'Dove Shampoo 340 ml (Pack of 2)', brand: 'Dove' };
    expect(scoreCandidate(shampoo, { title: 'Dove Shampoo 340 ml (Pack of 3)', brand: 'Dove' }).tier).toBe('spec-conflict');
    expect(scoreCandidate(shampoo, { title: 'Dove Shampoo 650 ml (Pack of 2)', brand: 'Dove' }).tier).toBe('spec-conflict');
  });

  it('matches an apparel listing with no model or GTIN as a possible match only', () => {
    const tee = { retailerId: 'myntra', title: 'Roadster Men Black Solid Round Neck T-shirt', brand: 'Roadster', model: '', gtin: '', variant: { color: 'Black', size: 'M', storage: '' }, price: 399 };
    const r = scoreCandidate(tee, { title: 'Roadster Men Solid Round Neck Black T-shirt', brand: 'Roadster', price: 349 });
    expect(r.confidence).toBe('possible');
  });
});

describe('brandless search-card titles (Amazon/Flipkart)', () => {
  it('still reaches "possible" when the candidate title omits the brand', () => {
    const src = { retailerId: 'myntra', title: 'Roadster Men Solid Round Neck Pure Cotton Black T-Shirt', brand: 'Roadster', model: '', gtin: '', variant: { color: '', size: '', storage: '' }, price: 173 };
    const r = scoreCandidate(src, { title: 'Men Solid Round Neck Pure Cotton Black T-Shirt', price: 179 });
    expect(r.confidence).toBe('possible');
  });
});
