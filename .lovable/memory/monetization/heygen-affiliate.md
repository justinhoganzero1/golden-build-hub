---
name: HeyGen Affiliate & API
description: HeyGen API key + affiliate referral link for animated character video generation
type: reference
---
- API key: stored as `HEYGEN_API_KEY` secret (used in edge functions for storyboard → animated 8K character movies)
- Affiliate program: https://www.heygen.com/affiliate (PartnerStack — up to ~30% recurring commission)
- Affiliate link constant: `HEYGEN_AFFILIATE_URL` in `src/lib/affiliateLinks.ts` — placeholder `https://www.heygen.com/?sid=oraclelunar`, replace with real PartnerStack URL once approved
- Owner Dashboard panel tracks clicks via localStorage key `affiliate_clicks_heygen` + `affiliate_clicks` table
- Use as CTA in: Photography Hub Story Board "Animate Story" button, Movie Studio character animation upgrade prompts
- Always open in new tab with `rel="noopener noreferrer sponsored"`
