------------------------------------------------
-- Tenants = Domains
INSERT INTO tenants (id, name, description) VALUES
('d1111111-aaaa-bbbb-cccc-111111111111', 'https://blogResearch.net', 'Primary domain for research-focused blogs'),
('d2222222-bbbb-cccc-dddd-222222222222', 'https://adventuresEdge.net', 'Adventure and exploration blog network');

------------------------------------------------
--Organizations = Blogs (per domain)
-- blogResearch.net
INSERT INTO organizations (id, tenant_id, name, description) VALUES
('o1111111-aaaa-bbbb-cccc-111111111111', 'd1111111-aaaa-bbbb-cccc-111111111111', 'BlogAI', 'AI research and analysis'),
('o2222222-bbbb-cccc-dddd-222222222222', 'd1111111-aaaa-bbbb-cccc-111111111111', 'Saints', 'Inspirational and spiritual writing');

-- adventuresEdge.net
INSERT INTO organizations (id, tenant_id, name, description) VALUES
('o3333333-cccc-dddd-eeee-333333333333', 'd2222222-bbbb-cccc-dddd-222222222222', 'blogResearch', 'Adventure-driven research content'),
('o4444444-dddd-eeee-ffff-444444444444', 'd2222222-bbbb-cccc-dddd-222222222222', 'Python', 'Exploration of Python programming and outdoor tech');

------------------------------------------------
--Users
INSERT INTO users (id, tenant_id, email, display_name, description) VALUES
('u1111111-aaaa-bbbb-cccc-111111111111', 'd1111111-aaaa-bbbb-cccc-111111111111', 'billkrat@example.com', 'Bill Kratochvil', 'Primary author and system owner'),
('u2222222-bbbb-cccc-dddd-222222222222', 'd1111111-aaaa-bbbb-cccc-111111111111', 'claude@example.com', 'Claude AI', 'AI assistant and contributor');

------------------------------------------------
--User <> Blog Membership
-- Bill
INSERT INTO user_organizations (user_id, organization_id) VALUES
('u1111111-aaaa-bbbb-cccc-111111111111', 'o1111111-aaaa-bbbb-cccc-111111111111'), -- BlogAI
('u1111111-aaaa-bbbb-cccc-111111111111', 'o2222222-bbbb-cccc-dddd-222222222222'); -- Saints

-- Claude
INSERT INTO user_organizations (user_id, organization_id) VALUES
('u2222222-bbbb-cccc-dddd-222222222222', 'o1111111-aaaa-bbbb-cccc-111111111111'), -- BlogAI
('u2222222-bbbb-cccc-dddd-222222222222', 'o3333333-cccc-dddd-eeee-333333333333'); -- adventuresEdge/blogResearch

------------------------------------------------
--Roles
-- blogResearch.net
INSERT INTO roles (id, tenant_id, name, description) VALUES
('r1111111-aaaa-bbbb-cccc-111111111111', 'd1111111-aaaa-bbbb-cccc-111111111111', 'Admin', 'Full domain access'),
('r2222222-bbbb-cccc-dddd-222222222222', 'd1111111-aaaa-bbbb-cccc-111111111111', 'Author', 'Can write and edit posts'),
('r3333333-cccc-dddd-eeee-333333333333', 'd1111111-aaaa-bbbb-cccc-111111111111', 'Editor', 'Can edit and publish posts');

-- adventuresEdge.net
INSERT INTO roles (id, tenant_id, name, description) VALUES
('r4444444-dddd-eeee-ffff-444444444444', 'd2222222-bbbb-cccc-dddd-222222222222', 'Admin', 'Full domain access'),
('r5555555-eeee-ffff-aaaa-555555555555', 'd2222222-bbbb-cccc-dddd-222222222222', 'Author', 'Can write and edit posts'),
('r6666666-ffff-aaaa-bbbb-666666666666', 'd2222222-bbbb-cccc-dddd-222222222222', 'Editor', 'Can edit and publish posts');

------------------------------------------------
--Permissions (global)
INSERT INTO permissions (id, code, description) VALUES
('p1111111-aaaa-bbbb-cccc-121212121212', 'BLOG_READ', 'Read blog content'),
('p2222222-bbbb-cccc-dddd-232323232323', 'BLOG_WRITE', 'Write blog posts'),
('p3333333-cccc-dddd-eeee-343434343434', 'BLOG_PUBLISH', 'Publish blog posts'),
('p4444444-dddd-eeee-ffff-454545454545', 'BLOG_ADMIN', 'Full administrative control');

------------------------------------------------
--Role ↔ Permission mappings
-- Author
INSERT INTO role_permissions VALUES
('r2222222-bbbb-cccc-dddd-222222222222', 'p1111111-aaaa-bbbb-cccc-121212121212'),
('r2222222-bbbb-cccc-dddd-222222222222', 'p2222222-bbbb-cccc-dddd-232323232323');

-- Editor
INSERT INTO role_permissions VALUES
('r3333333-cccc-dddd-eeee-333333333333', 'p1111111-aaaa-bbbb-cccc-121212121212'),
('r3333333-cccc-dddd-eeee-333333333333', 'p2222222-bbbb-cccc-dddd-232323232323'),
('r3333333-cccc-dddd-eeee-333333333333', 'p3333333-cccc-dddd-eeee-343434343434');

-- Admin
INSERT INTO role_permissions VALUES
('r1111111-aaaa-bbbb-cccc-111111111111', 'p1111111-aaaa-bbbb-cccc-121212121212'),
('r1111111-aaaa-bbbb-cccc-111111111111', 'p2222222-bbbb-cccc-dddd-232323232323'),
('r1111111-aaaa-bbbb-cccc-111111111111', 'p3333333-cccc-dddd-eeee-343434343434'),
('r1111111-aaaa-bbbb-cccc-111111111111', 'p4444444-dddd-eeee-ffff-454545454545');

------------------------------------------------
--User ↔ Role assignments
-- blogResearch.net
INSERT INTO user_roles VALUES
('u1111111-aaaa-bbbb-cccc-111111111111', 'r2222222-bbbb-cccc-dddd-222222222222'), -- Bill → Author
('u2222222-bbbb-cccc-dddd-222222222222', 'r3333333-cccc-dddd-eeee-333333333333'); -- Claude → Editor

-- adventuresEdge.net
INSERT INTO user_roles VALUES
('u1111111-aaaa-bbbb-cccc-111111111111', 'r5555555-eeee-ffff-aaaa-555555555555'), -- Bill → Author
('u2222222-bbbb-cccc-dddd-222222222222', 'r6666666-ffff-aaaa-bbbb-666666666666'); -- Claude → Editor
