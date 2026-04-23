from crawler.url_filter import is_in_scope

# Toronto.ca pages should all be in scope
def test_permit_page_in_scope():
    assert is_in_scope("https://www.toronto.ca/services-payments/building-construction/building-permit/") is True

def test_building_construction_in_scope():
    assert is_in_scope("https://www.toronto.ca/services-payments/building-construction/") is True

def test_property_tax_in_scope():
    assert is_in_scope("https://www.toronto.ca/services-payments/property-taxes-utilities/property-tax/") is True

def test_recycling_in_scope():
    assert is_in_scope("https://www.toronto.ca/services-payments/recycling-organics-garbage/houses/") is True

def test_planning_in_scope():
    assert is_in_scope("https://www.toronto.ca/city-government/planning-development/") is True

def test_community_in_scope():
    assert is_in_scope("https://www.toronto.ca/community-people/housing-shelter/") is True

def test_recreation_in_scope():
    assert is_in_scope("https://www.toronto.ca/explore-enjoy/recreation/swimming/") is True

def test_business_in_scope():
    assert is_in_scope("https://www.toronto.ca/business-economy/new-businesses-startups/") is True

def test_pdf_in_scope():
    assert is_in_scope("https://www.toronto.ca/wp-content/uploads/2023/building-permit-guide.pdf") is True

def test_homepage_in_scope():
    assert is_in_scope("https://www.toronto.ca/") is True

# External sites should be out of scope
def test_external_url_out_of_scope():
    assert is_in_scope("https://www.ontario.ca/page/building-code") is False

def test_other_domain_out_of_scope():
    assert is_in_scope("https://www.google.com/search?q=toronto") is False

# Excluded paths should be out of scope
def test_wp_admin_excluded():
    assert is_in_scope("https://www.toronto.ca/wp-admin/") is False

def test_account_excluded():
    assert is_in_scope("https://www.toronto.ca/account/login") is False

def test_wp_json_excluded():
    assert is_in_scope("https://www.toronto.ca/wp-json/wp/v2/posts") is False

def test_feed_excluded():
    assert is_in_scope("https://www.toronto.ca/feed/") is False
