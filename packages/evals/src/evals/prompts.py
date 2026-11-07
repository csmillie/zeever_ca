from evals.models import BenchmarkPrompt

# NOTE: bp-35, bp-57 and bp-70 were flagged expects_refusal on the evidence that
# nothing in the corpus answered them. That was wrong. All three ARE answered on
# toronto.ca, in the 311 knowledge base, which the crawler has never fetched:
#   bp-35  /311/knowledgebase/kb/docs/articles/revenue-services/.../opening-a-water-account
#   bp-57  /311/knowledgebase/kb/docs/articles/transportation-services/.../street-cleaning
#   bp-70  /311/knowledgebase/kb/docs/articles/toronto-water/.../watermain-break
# toronto.ca/sitemap.xml lists eight WordPress page sitemaps and nothing else, so
# sitemap-based discovery cannot reach the knowledge base at all. The flags were
# recording a crawl gap as a content gap, which is precisely what they must not
# do. Do not re-add one without checking toronto.ca directly first.

BENCHMARK_PROMPTS = [
    # ===== BUILDING PERMITS (1-12, original suite) =====
    BenchmarkPrompt(id="bp-01", prompt="Do I need a building permit to build a deck in Toronto?", category="building-permits", expected_signals=["permit", "deck", "size", "height"], expected_sources=["when-do-i-need-a-building-permit"]),
    BenchmarkPrompt(id="bp-02", prompt="What documents do I need to submit with a building permit application?", category="building-permits", expected_signals=["drawings", "site plan", "application form"], expected_sources=["building-permit-application-guides"]),
    BenchmarkPrompt(id="bp-03", prompt="How much does a residential building permit cost in Toronto?", category="building-permits", expected_signals=["fee", "cost", "per square"], expected_sources=["building-permit-fees"]),
    BenchmarkPrompt(id="bp-04", prompt="What is the process for applying for a building permit in Toronto?", category="building-permits", expected_signals=["apply", "submit", "review", "approval"], expected_sources=["before-you-apply"]),
    BenchmarkPrompt(id="bp-05", prompt="How long does it take to get a building permit approved?", category="building-permits", expected_signals=["days", "weeks", "review stream", "timeline"], expected_sources=["building-permit-review-streams"]),
    BenchmarkPrompt(id="bp-06", prompt="What inspections are required during construction in Toronto?", category="building-permits", expected_signals=["inspection", "mandatory", "stage"], expected_sources=["building-inspections"]),
    BenchmarkPrompt(id="bp-07", prompt="Do I need a permit to finish my basement in Toronto?", category="building-permits", expected_signals=["permit", "basement", "interior"], expected_sources=["when-do-i-need-a-building-permit"]),
    BenchmarkPrompt(id="bp-08", prompt="Can I apply for a building permit online in Toronto?", category="building-permits", expected_signals=["online", "electronic", "submit"], expected_sources=["electronic-submission"]),
    BenchmarkPrompt(id="bp-09", prompt="What is an express building permit and do I qualify?", category="building-permits", expected_signals=["express", "eligible", "faster"], expected_sources=["express-building-permits"]),
    BenchmarkPrompt(id="bp-10", prompt="Do I need a permit to build a fence in Toronto?", category="building-permits", expected_signals=["fence", "permit", "pool"], expected_sources=["pool-fence", "when-do-i-need"]),
    BenchmarkPrompt(id="bp-11", prompt="What happens if I build without a permit in Toronto?", category="building-permits", expected_signals=["enforcement", "stop work", "penalty"], expected_sources=['working-without-a-permit']),
    BenchmarkPrompt(id="bp-12", prompt="What are the requirements for a laneway suite permit?", category="building-permits", expected_signals=["laneway", "suite", "pre-approved", "requirements"], expected_sources=['new-laneway-suite']),

    # ===== SIGN PERMITS (13-16) =====
    BenchmarkPrompt(id="bp-13", prompt="Do I need a sign permit in Toronto?", category="sign-permits", expected_signals=["sign", "permit", "by-law"], expected_sources=["sign-permits"]),
    BenchmarkPrompt(id="bp-14", prompt="What types of signs require a permit in Toronto?", category="sign-permits", expected_signals=["sign", "type", "permit"], expected_sources=["sign-permits"]),
    BenchmarkPrompt(id="bp-15", prompt="How do I apply for a sign variance in Toronto?", category="sign-permits", expected_signals=["variance", "sign", "apply"], expected_sources=["sign-permits"]),
    BenchmarkPrompt(id="bp-16", prompt="What are the rules for temporary signs in Toronto?", category="sign-permits", expected_signals=["temporary", "sign", "rules"], expected_sources=["sign-permits"]),

    # ===== TREE & RAVINE PERMITS (17-20) =====
    BenchmarkPrompt(id="bp-17", prompt="Do I need a permit to remove a tree on my property in Toronto?", category="tree-permits", expected_signals=["tree", "permit", "private", "diameter"], expected_sources=['permit-to-injure-or-remove-trees']),
    BenchmarkPrompt(id="bp-18", prompt="What is the tree protection bylaw in Toronto?", category="tree-permits", expected_signals=["tree", "bylaw", "protection", "private"], expected_sources=['tree-protection']),
    BenchmarkPrompt(id="bp-19", prompt="How do I apply for a ravine protection permit?", category="tree-permits", expected_signals=["ravine", "permit", "apply"], expected_sources=['how-to-apply-for-a-tree-or-ravine-permit']),
    BenchmarkPrompt(id="bp-20", prompt="What happens if I cut down a protected tree without a permit?", category="tree-permits", expected_signals=["tree", "penalty", "fine"], expected_sources=['permit-to-injure-or-remove-trees']),

    # ===== ZONING (21-24) =====
    BenchmarkPrompt(id="bp-21", prompt="How do I get a zoning review in Toronto?", category="zoning", expected_signals=["zoning", "review", "apply"], expected_sources=["zoning-review", "preliminary-zoning"]),
    BenchmarkPrompt(id="bp-22", prompt="What is a zoning certificate in Toronto?", category="zoning", expected_signals=["zoning", "certificate"], expected_sources=["zoning-certificate"]),
    BenchmarkPrompt(id="bp-23", prompt="How do I find the zoning for my property in Toronto?", category="zoning", expected_signals=["zoning", "property", "bylaw"], expected_sources=["zoning"]),
    BenchmarkPrompt(id="bp-24", prompt="What is a committee of adjustment minor variance?", category="zoning", expected_signals=["committee", "adjustment", "variance"], expected_sources=["committee-of-adjustment"]),

    # ===== PROPERTY TAX (25-32) =====
    BenchmarkPrompt(id="bp-25", prompt="How do I pay my property tax in Toronto?", category="property-tax", expected_signals=["pay", "property tax", "payment"], expected_sources=['pay-your-property-tax-bill']),
    BenchmarkPrompt(id="bp-26", prompt="When is my property tax due in Toronto?", category="property-tax", expected_signals=["due", "date", "property tax"], expected_sources=['property-tax-due-dates']),
    BenchmarkPrompt(id="bp-27", prompt="How do I set up a pre-authorized payment plan for property taxes?", category="property-tax", expected_signals=["pre-authorized", "payment", "plan"], expected_sources=['pre-authorized-tax-payment-ptp-program']),
    BenchmarkPrompt(id="bp-28", prompt="What is the municipal land transfer tax in Toronto?", category="property-tax", expected_signals=["land transfer", "tax", "rate"], expected_sources=["municipal-land-transfer-tax"]),
    BenchmarkPrompt(id="bp-29", prompt="What is the vacant home tax in Toronto?", category="property-tax", expected_signals=["vacant", "home", "tax", "declaration"], expected_sources=["vacant-home-tax"]),
    BenchmarkPrompt(id="bp-30", prompt="Am I eligible for a property tax relief program?", category="property-tax", expected_signals=["relief", "program", "eligible"], expected_sources=['property-tax-and-utility-relief-program']),
    BenchmarkPrompt(id="bp-31", prompt="How do I look up my property tax account online?", category="property-tax", expected_signals=["lookup", "account", "online"], expected_sources=["property-tax-lookup"]),
    BenchmarkPrompt(id="bp-32", prompt="What is the municipal accommodation tax in Toronto?", category="property-tax", expected_signals=["accommodation", "tax", "hotel"], expected_sources=["municipal-accommodation-tax"]),

    # ===== UTILITY BILLS (33-36) =====
    BenchmarkPrompt(id="bp-33", prompt="How do I pay my water bill in Toronto?", category="utilities", expected_signals=["water", "bill", "pay"], expected_sources=['pay-your-utility-bill']),
    BenchmarkPrompt(id="bp-34", prompt="How do I read my Toronto utility bill?", category="utilities", expected_signals=["utility", "bill", "read", "understand"], expected_sources=["utility-bill"]),






    BenchmarkPrompt(id="bp-35", prompt="How do I set up a new water account in Toronto?", category="utilities", expected_signals=["water", "account", "new"], expected_sources=["utility-bill"]),
    BenchmarkPrompt(id="bp-36", prompt="What is a tax and utility certificate in Toronto?", category="utilities", expected_signals=["certificate", "tax", "utility"], expected_sources=["tax-utility-certificate"]),

    # ===== BUSINESS LICENCES (37-42) =====
    BenchmarkPrompt(id="bp-37", prompt="Do I need a business licence to operate in Toronto?", category="business-licences", expected_signals=["business", "licence", "require"], expected_sources=["permits-licences"]),
    BenchmarkPrompt(id="bp-38", prompt="How do I apply for a business licence in Toronto?", category="business-licences", expected_signals=["apply", "business", "licence"], expected_sources=["business-licences"]),
    BenchmarkPrompt(id="bp-39", prompt="How do I renew my business licence in Toronto?", category="business-licences", expected_signals=["renew", "business", "licence"], expected_sources=["business-licence"]),
    BenchmarkPrompt(id="bp-40", prompt="What types of businesses need a licence in Toronto?", category="business-licences", expected_signals=["type", "business", "licence"], expected_sources=["find-licence-permit"]),
    BenchmarkPrompt(id="bp-41", prompt="How do I get a lottery licence in Toronto?", category="business-licences", expected_signals=["lottery", "licence", "charitable"], expected_sources=["lottery-licences"]),
    BenchmarkPrompt(id="bp-42", prompt="What are the hours of operation for a business licence office?", category="business-licences", expected_signals=["hours", "contact", "office"], expected_sources=["contact-us", "permits-licences"]),

    # ===== RECYCLING & GARBAGE (43-50) =====
    BenchmarkPrompt(id="bp-43", prompt="What goes in the blue bin in Toronto?", category="recycling", expected_signals=["blue", "bin", "recycling"], expected_sources=["recycling", "houses"]),
    BenchmarkPrompt(id="bp-44", prompt="What goes in the green bin in Toronto?", category="recycling", expected_signals=["green", "bin", "organics"], expected_sources=['what-goes-in-my-green-bin']),
    BenchmarkPrompt(id="bp-45", prompt="What is my garbage collection day in Toronto?", category="recycling", expected_signals=["collection", "day", "schedule"], expected_sources=['collection-schedule']),
    BenchmarkPrompt(id="bp-46", prompt="Where can I drop off hazardous waste in Toronto?", category="recycling", expected_signals=["hazardous", "waste", "drop-off"], expected_sources=["drop-off-depots"]),
    BenchmarkPrompt(id="bp-47", prompt="How do I get a larger garbage bin in Toronto?", category="recycling", expected_signals=["bin", "size", "larger"], expected_sources=['garbage-bin-sizes-fees']),
    BenchmarkPrompt(id="bp-48", prompt="What items are not accepted in Toronto recycling?", category="recycling", expected_signals=["not accepted", "recycling", "contamination"], expected_sources=['accepted-items']),
    BenchmarkPrompt(id="bp-49", prompt="How do I dispose of electronics in Toronto?", category="recycling", expected_signals=["electronics", "dispose", "e-waste"], expected_sources=["drop-off", "waste"]),
    BenchmarkPrompt(id="bp-50", prompt="What are the rules for recycling in apartment buildings?", category="recycling", expected_signals=["apartment", "recycling", "multi-unit"], expected_sources=["apartments-condos"]),

    # ===== STREETS & PARKING (51-58) =====
    BenchmarkPrompt(id="bp-51", prompt="How do I apply for a residential parking permit in Toronto?", category="parking", expected_signals=["parking", "permit", "residential", "apply"], expected_sources=['residential-on-street-parking']),
    BenchmarkPrompt(id="bp-52", prompt="How much does a parking permit cost in Toronto?", category="parking", expected_signals=["parking", "permit", "cost", "fee"], expected_sources=["parking-permit"]),
    BenchmarkPrompt(id="bp-53", prompt="Where can I find road closures in Toronto?", category="streets", expected_signals=["road", "closure", "construction"], expected_sources=["road-restrictions"]),
    BenchmarkPrompt(id="bp-54", prompt="How do I report a pothole in Toronto?", category="streets", expected_signals=["pothole", "report", "road"], expected_sources=['potholes']),
    BenchmarkPrompt(id="bp-55", prompt="What are the cycling routes in Toronto?", category="streets", expected_signals=["cycling", "route", "bike"], expected_sources=["cycling-in-toronto"]),
    BenchmarkPrompt(id="bp-56", prompt="How do I get a street event permit in Toronto?", category="streets", expected_signals=["street", "event", "permit"], expected_sources=["street-events"]),









    BenchmarkPrompt(id="bp-57", prompt="When does street cleaning happen in Toronto?", category="streets", expected_signals=["street", "cleaning", "sweeping", "schedule"], expected_sources=["road-maintenance"]),
    BenchmarkPrompt(id="bp-58", prompt="How does Toronto handle snow removal?", category="streets", expected_signals=["snow", "removal", "plow", "winter"], expected_sources=["road-maintenance"]),

    # ===== TICKETS & FINES (59-64) =====
    BenchmarkPrompt(id="bp-59", prompt="How do I pay a parking ticket in Toronto?", category="tickets", expected_signals=["parking", "ticket", "pay"], expected_sources=['pay-your-parking-violation']),
    BenchmarkPrompt(id="bp-60", prompt="How do I dispute a parking ticket in Toronto?", category="tickets", expected_signals=["dispute", "parking", "ticket", "appeal"], expected_sources=['dispute-your-parking-violation']),
    BenchmarkPrompt(id="bp-61", prompt="What happens if I don't pay a parking ticket in Toronto?", category="tickets", expected_signals=["unpaid", "ticket", "penalty", "plate"], expected_sources=["parking-violations"]),
    BenchmarkPrompt(id="bp-62", prompt="How do automated speed cameras work in Toronto?", category="tickets", expected_signals=["speed", "camera", "automated", "penalty"], expected_sources=["automated-speed"]),
    BenchmarkPrompt(id="bp-63", prompt="How do I pay a red light camera ticket?", category="tickets", expected_signals=["red light", "camera", "ticket", "pay"], expected_sources=['pay-red-light-camera-penalties']),
    BenchmarkPrompt(id="bp-64", prompt="Where is the provincial offences court in Toronto?", category="tickets", expected_signals=["court", "provincial", "offence", "location"], expected_sources=['key-info-provincial-offences']),

    # ===== WATER & ENVIRONMENT (65-70) =====
    BenchmarkPrompt(id="bp-65", prompt="Is Toronto tap water safe to drink?", category="water", expected_signals=["tap water", "safe", "quality"], expected_sources=["tap-water"]),
    BenchmarkPrompt(id="bp-66", prompt="How do I get my water tested for lead in Toronto?", category="water", expected_signals=["lead", "water", "test"], expected_sources=['lead-testing-for-residents']),
    BenchmarkPrompt(id="bp-67", prompt="What is the basement flooding protection subsidy in Toronto?", category="water", expected_signals=["basement", "flooding", "subsidy", "protection"], expected_sources=['basement-flooding-protection-subsidy-program']),
    BenchmarkPrompt(id="bp-68", prompt="How do I read my water meter in Toronto?", category="water", expected_signals=["water", "meter", "read"], expected_sources=['water-meters']),
    BenchmarkPrompt(id="bp-69", prompt="What is the downspout disconnection program in Toronto?", category="water", expected_signals=["downspout", "disconnect", "mandatory"], expected_sources=["downspout-disconnection"]),









    BenchmarkPrompt(id="bp-70", prompt="How do I report a water main break in Toronto?", category="water", expected_signals=["water", "main", "break", "report"], expected_sources=["water"]),

    # ===== GRANTS & INCENTIVES (71-74) =====
    BenchmarkPrompt(id="bp-71", prompt="What home energy grants are available in Toronto?", category="grants", expected_signals=["energy", "grant", "home", "loan"], expected_sources=["environmental-grants", "energy"]),
    BenchmarkPrompt(id="bp-72", prompt="What is the green roof incentive in Toronto?", category="grants", expected_signals=["green", "roof", "incentive"], expected_sources=["green-your-roof"]),
    BenchmarkPrompt(id="bp-73", prompt="Are there community grants available in Toronto?", category="grants", expected_signals=["community", "grant", "funding"], expected_sources=["grants-incentives", "community"]),
    BenchmarkPrompt(id="bp-74", prompt="How does the facade improvement program work in Toronto?", category="grants", expected_signals=["facade", "improvement", "grant", "business"], expected_sources=["grants-incentives", "facade"]),

    # ===== HOUSING & SHELTER (75-80) =====
    BenchmarkPrompt(id="bp-75", prompt="How do I find affordable housing in Toronto?", category="housing", expected_signals=["affordable", "housing", "apply", "waitlist"], expected_sources=["housing-shelter"]),
    BenchmarkPrompt(id="bp-76", prompt="What are my rights as a tenant in Toronto?", category="housing", expected_signals=["tenant", "rights", "landlord"], expected_sources=["housing", "tenant"]),
    BenchmarkPrompt(id="bp-77", prompt="How do I access emergency shelter in Toronto?", category="housing", expected_signals=["shelter", "emergency", "access"], expected_sources=["housing-shelter"]),
    BenchmarkPrompt(id="bp-78", prompt="What financial support is available for renters in Toronto?", category="housing", expected_signals=["financial", "support", "renter", "assistance"], expected_sources=["financial-support-for-renters"]),
    BenchmarkPrompt(id="bp-79", prompt="What is the housing stabilization fund in Toronto?", category="housing", expected_signals=["housing", "stabilization", "fund"], expected_sources=["housing-stabilization"]),
    BenchmarkPrompt(id="bp-80", prompt="How do I apply for rent-geared-to-income housing?", category="housing", expected_signals=["rent", "income", "housing", "apply"], expected_sources=["housing"]),

    # ===== HEALTH & COMMUNITY (81-86) =====
    BenchmarkPrompt(id="bp-81", prompt="Where can I get vaccinated in Toronto?", category="health", expected_signals=["vaccine", "vaccination", "immunization"], expected_sources=["health"]),
    BenchmarkPrompt(id="bp-82", prompt="What public health programs are available in Toronto?", category="health", expected_signals=["public health", "program"], expected_sources=["health-wellness"]),
    BenchmarkPrompt(id="bp-83", prompt="How do I access mental health services in Toronto?", category="health", expected_signals=["mental health", "service", "support"], expected_sources=["health"]),
    BenchmarkPrompt(id="bp-84", prompt="What is the student nutrition program in Toronto?", category="health", expected_signals=["student", "nutrition", "program"], expected_sources=["student-nutrition"]),
    BenchmarkPrompt(id="bp-85", prompt="What settlement services are available for newcomers to Toronto?", category="community", expected_signals=["newcomer", "settlement", "immigration"], expected_sources=["community-people"]),
    BenchmarkPrompt(id="bp-86", prompt="How do I access employment support services in Toronto?", category="community", expected_signals=["employment", "support", "job"], expected_sources=["employment-social-support"]),

    # ===== PARKS & RECREATION (87-94) =====
    BenchmarkPrompt(id="bp-87", prompt="How do I register for recreation programs in Toronto?", category="recreation", expected_signals=["register", "recreation", "program"], expected_sources=['how-to-register-for-recreation-programs']),
    BenchmarkPrompt(id="bp-88", prompt="Where can I go swimming in Toronto?", category="recreation", expected_signals=["swimming", "pool", "aquatic"], expected_sources=['swimming-water-play']),
    BenchmarkPrompt(id="bp-89", prompt="Where are the outdoor skating rinks in Toronto?", category="recreation", expected_signals=["skating", "rink", "outdoor", "ice"], expected_sources=['public-leisure-skating']),
    BenchmarkPrompt(id="bp-90", prompt="How do I book a park permit in Toronto?", category="recreation", expected_signals=["park", "permit", "book"], expected_sources=["booking-park"]),
    BenchmarkPrompt(id="bp-91", prompt="What are the off-leash dog parks in Toronto?", category="recreation", expected_signals=["dog", "off-leash", "park"], expected_sources=["parks"]),
    BenchmarkPrompt(id="bp-92", prompt="How do I get to the Toronto Islands?", category="recreation", expected_signals=["island", "ferry", "schedule"], expected_sources=["toronto-island"]),
    BenchmarkPrompt(id="bp-93", prompt="What community centres are in Toronto?", category="recreation", expected_signals=["community", "centre", "recreation"], expected_sources=['parks-and-community-recreation-centres-map']),
    BenchmarkPrompt(id="bp-94", prompt="Are there free recreation programs in Toronto?", category="recreation", expected_signals=["free", "recreation", "program"], expected_sources=['free-lower-cost-recreation-options']),

    # ===== CITY GOVERNMENT (95-100) =====
    BenchmarkPrompt(id="bp-95", prompt="Who is my city councillor in Toronto?", category="city-government", expected_signals=["councillor", "ward", "council"], expected_sources=["council"]),
    BenchmarkPrompt(id="bp-96", prompt="How do I access Toronto open data?", category="city-government", expected_signals=["open data", "data", "access"], expected_sources=["open-data", "data-research"]),
    BenchmarkPrompt(id="bp-97", prompt="What is the city budget for Toronto?", category="city-government", expected_signals=["budget", "city", "finance"], expected_sources=["budget-finances"]),
    BenchmarkPrompt(id="bp-98", prompt="How do I file a complaint with the city ombudsman?", category="city-government", expected_signals=["ombudsman", "complaint", "file"], expected_sources=['ombudsman-toronto']),
    BenchmarkPrompt(id="bp-99", prompt="When is the next Toronto municipal election?", category="city-government", expected_signals=["election", "municipal", "vote", "date"], expected_sources=["elections"]),
    BenchmarkPrompt(id="bp-100", prompt="How do I request a heritage property designation in Toronto?", category="city-government", expected_signals=["heritage", "designation", "property"], expected_sources=["heritage-preservation"]),
]
