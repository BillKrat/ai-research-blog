PRAGMA foreign_keys = ON;

-- =========================
-- TENANTS
-- =========================
CREATE TABLE tenants (
    id              TEXT PRIMARY KEY,              -- GUID
    name            TEXT NOT NULL UNIQUE,
    description     TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- =========================
-- ORGANIZATIONS (within a tenant)
-- =========================
CREATE TABLE organizations (
    id              TEXT PRIMARY KEY,              -- GUID
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE (tenant_id, name)
);

-- =========================
-- USERS (scoped to tenant)
-- =========================
CREATE TABLE users (
    id              TEXT PRIMARY KEY,              -- GUID
    tenant_id       TEXT NOT NULL,
    email           TEXT NOT NULL,
    display_name    TEXT,
    description     TEXT,                          -- optional profile notes
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE (tenant_id, email)
);

-- =========================
-- USER ↔ ORGANIZATION (many-to-many)
-- =========================
CREATE TABLE user_organizations (
    user_id         TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    PRIMARY KEY (user_id, organization_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- =========================
-- ROLES (per tenant)
-- =========================
CREATE TABLE roles (
    id              TEXT PRIMARY KEY,              -- GUID
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE (tenant_id, name)
);

-- =========================
-- PERMISSIONS (global — no tenant_id column; scope to a tenant would
-- require adding one, not implied by this comment alone)
-- =========================
CREATE TABLE permissions (
    id              TEXT PRIMARY KEY,              -- GUID
    code            TEXT NOT NULL UNIQUE,          -- e.g. ORG_READ, USER_MANAGE
    description     TEXT
);

-- =========================
-- ROLE ↔ PERMISSION (many-to-many)
-- =========================
CREATE TABLE role_permissions (
    role_id         TEXT NOT NULL,
    permission_id   TEXT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- =========================
-- USER ↔ ROLE (many-to-many)
-- =========================
CREATE TABLE user_roles (
    user_id         TEXT NOT NULL,
    role_id         TEXT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);
