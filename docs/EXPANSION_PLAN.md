# Toronto.ca Full Coverage Expansion Plan

## Current state

Zeever.ca covers 100% of the **Services & Payments** section of Toronto.ca (9/9 categories, ~1,300 pages). This is 20% of the total site by page count.

## Toronto.ca site structure

| Section | Pages | % of site | Status |
|---------|------:|:---------:|--------|
| Services & Payments | 1,300 | 20% | Covered |
| City Government | 2,470 | 39% | Phase 1 |
| Community & People | 1,577 | 25% | Phase 2 |
| Explore & Enjoy | 608 | 10% | Phase 3 |
| Business & Economy | 260 | 4% | Phase 4 |
| Other (home, account) | 166 | 2% | Phase 5 |
| **Total** | **6,381** | **100%** | |

## Phase 1: City Government (2,470 pages)

**URL prefix:** `/city-government/`

The largest section. Covers council decisions, planning, budgets, accountability, and city administration.

**Key sub-sections:**
- Planning & Development (official plan, zoning bylaws, development applications)
- Council & Committees (agendas, minutes, decisions)
- Budget & Finance (city budgets, financial reports)
- Accountability & Operations (auditor general, ombudsman, open data)
- Data & Research (demographic data, surveys, reports)

**Estimated effort:** Medium-high. Lots of pages but many are archival (old council minutes). Needs content type filtering to avoid indexing thousands of meeting minutes.

**Recommended approach:**
- Start with Planning & Development (most relevant to existing permit users)
- Add Accountability & Operations for transparency questions
- Skip archival council minutes initially (index current year only)
- Add a date filter to the crawler to limit old content

**Impact:** Covers zoning bylaw details, development applications, and city planning questions that are directly adjacent to building permits.

## Phase 2: Community & People (1,577 pages)

**URL prefix:** `/community-people/`

Social services, housing, health, immigration, and community programs.

**Key sub-sections:**
- Housing & Shelter (affordable housing, tenant rights, shelter system)
- Employment & Social Support (financial assistance, job programs)
- Health & Wellness (public health, mental health, clinics)
- Community Partners (funding, space tenancy, community grants)
- Immigration & Settlement (newcomer services)

**Estimated effort:** Medium. Good content quality, mostly informational pages.

**Recommended approach:**
- Housing & Shelter first (high demand, adjacent to property/permits)
- Employment & Social Support next (high-traffic service pages)
- Health last (may overlap with provincial health services)

**Impact:** Covers the most common social service questions. Housing and tenant rights are especially high-value.

## Phase 3: Explore & Enjoy (608 pages)

**URL prefix:** `/explore-enjoy/`

Parks, recreation, arts, culture, events, and tourism.

**Key sub-sections:**
- Parks, Gardens & Beaches (park locations, rules, seasonal info)
- Recreation (programs, pools, rinks, community centres)
- Arts & Culture (museums, galleries, public art)
- Festivals & Events (major city events, permits)
- History & Heritage (historical sites, walking tours)

**Estimated effort:** Low-medium. Fewer pages, good content quality.

**Recommended approach:** Crawl the entire section at once. It's small enough to index fully.

**Impact:** Answers "where can I swim?" / "what parks are near me?" / "how do I register for a rec program?" type questions.

## Phase 4: Business & Economy (260 pages)

**URL prefix:** `/business-economy/`

Business support, starting a business, commercial regulations.

**Key sub-sections:**
- New Businesses & Startups (guides, regulations)
- Business Operation & Growth (incentives, BIAs)
- Industry Opportunities (procurement, partnerships)
- Economic Data & Research

**Estimated effort:** Low. Small section, mostly informational.

**Recommended approach:** Crawl the entire section. Some overlap with Tier 2 business licences content.

**Impact:** Answers "how do I start a business in Toronto?" type questions.

## Phase 5: Remaining pages (166 pages)

Homepage content, account pages, miscellaneous. Low priority, skip initially.

## Technical considerations for full coverage

### Database scaling
- Current: ~10,000 chunks, works fine with IVFFlat on pgvector
- At 100%: estimate ~30,000-50,000 chunks
- May need to rebuild IVFFlat index with more lists (100 instead of 20)
- Consider HNSW index instead of IVFFlat for better recall at scale

### Embedding costs
- Current corpus: ~$5 to embed via Fireworks/Nomic
- Full site: estimate ~$15-25 one-time cost
- Re-embedding on content refresh: same cost per run

### Query classification
- Current classifier is keyword-based and will need expansion for new topics
- Consider switching to embedding-based classification at full scale

### Content freshness
- Toronto.ca content changes frequently (council decisions, event schedules)
- Recommend weekly re-crawl of high-change sections (council, events)
- Monthly re-crawl of stable sections (permits, taxes, water)

### Storage
- Current DB: ~2GB
- Full site estimate: ~6-10GB
- Well within VPS capacity (100GB NVMe)

## Recommended execution order

1. **Now:** Complete Services & Payments (done)
2. **Next sprint:** Phase 1 Planning & Development subset (most adjacent to current content)
3. **Following sprint:** Phase 2 Housing & Employment (highest social impact)
4. **Then:** Phase 3 + Phase 4 together (small, can do in one pass)
5. **Last:** Phase 1 remaining (council archives, budget docs)

Each phase follows the same pipeline: update URL filter, add seed URLs, crawl, parse, embed, test.
