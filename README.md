# ClarioBase Website

### Production website for a focused digital-services proposition

[View the live website](https://clariobase.pl/) · [Explore the AI CRM](https://github.com/lukexd09/clariobase-ai-crm)

ClarioBase helps Polish beauty businesses present their offer clearly online and guide potential clients toward contact. This repository contains the production marketing website behind that proposition.

It is also a compact product-delivery case study: a business idea translated into positioning, packages, customer journey, content structure, analytics, privacy controls, SEO and a deployed product.

| | |
|---|---|
| **My role** | Product owner · Technical Project Manager · website strategist · AI-assisted builder |
| **Delivery scope** | Proposition → information architecture → content → implementation → analytics/SEO → deployment |
| **Technology** | Semantic HTML · CSS · JavaScript · Vercel |
| **Audience** | Beauty salons, cosmetologists and independent beauty specialists in Poland |
| **Status** | Live production website |

## What this project demonstrates

- converting a business model into a clear digital customer journey,
- defining service packages and calls to action around user intent,
- combining product, content, UX and technical delivery in one workstream,
- implementing analytics with consent-aware defaults,
- treating accessibility, SEO, structured data and performance as delivery requirements,
- shipping and operating a small production product with a deliberately simple stack.

## Product decisions

- A focused single-page journey keeps the proposition, packages, scope, process and contact path easy to understand.
- The content is designed for a specific vertical rather than a generic “web agency” audience.
- Responsive assets and a lightweight implementation reduce operational complexity.
- Semantic markup, keyboard navigation support and a skip link improve accessibility.
- Organization, website, service and offer structured data support search discoverability.
- Analytics consent defaults to denied until the visitor makes a choice.

## Main areas

- value proposition and audience fit,
- service packages,
- delivery scope and process,
- trust-building and founder context,
- contact and mini-audit conversion paths,
- privacy policy and consent management,
- technical SEO, social metadata and sitemap.

## Repository structure

```text
index.html                 Main product and conversion journey
polityka-prywatnosci.html Privacy information
styles.css                Responsive visual system
script.js                 Navigation, interaction, consent and analytics behavior
assets/                   Optimized brand and page imagery
vercel.json               Deployment configuration
robots.txt / sitemap.xml  Search-engine directives
```

## Run locally

The website is static and requires no build step.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Related product

[ClarioBase AI CRM](https://github.com/lukexd09/clariobase-ai-crm) shows the operational side of the business: lead management, prioritization, sales workflow and controlled AI-assisted enrichment.

