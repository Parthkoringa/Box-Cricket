-- =====================================================================
-- Box Cricket Ground — Booking Management System (Version 1)
-- PostgreSQL schema — Hosted on Neon
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE user_role AS ENUM ('owner', 'worker');

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(100) NOT NULL,
    phone         VARCHAR(15)  NOT NULL UNIQUE,
    email         VARCHAR(150) UNIQUE,
    password_hash TEXT NOT NULL,
    role          user_role NOT NULL,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE venues (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(150) NOT NULL,
    address    TEXT,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE courts (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id   UUID NOT NULL REFERENCES venues(id),
    name       VARCHAR(100) NOT NULL,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE booking_status AS ENUM (
    'confirmed', 'arrived', 'completed', 'cancelled', 'no_show'
);

CREATE TABLE bookings (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    court_id              UUID NOT NULL REFERENCES courts(id),
    customer_name         VARCHAR(100) NOT NULL,
    customer_phone        VARCHAR(15)  NOT NULL,
    booking_date          DATE NOT NULL,
    start_time            TIMESTAMPTZ NOT NULL,
    end_time              TIMESTAMPTZ NOT NULL,
    total_amount          NUMERIC(10,2) NOT NULL,
    status                booking_status NOT NULL DEFAULT 'confirmed',
    advance_forfeited     BOOLEAN NOT NULL DEFAULT FALSE,
    cancellation_reason   TEXT,
    reminder_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    created_by            UUID NOT NULL REFERENCES users(id),
    updated_by            UUID REFERENCES users(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_time_order CHECK (end_time > start_time)
);

ALTER TABLE bookings ADD CONSTRAINT no_overlapping_bookings
    EXCLUDE USING gist (
        court_id WITH =,
        tstzrange(start_time, end_time) WITH &&
    ) WHERE (status NOT IN ('cancelled', 'no_show'));

CREATE TYPE payment_type   AS ENUM ('advance', 'remaining', 'extra');
CREATE TYPE payment_method AS ENUM ('cash', 'upi', 'card', 'online');

CREATE TABLE payments (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id   UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    amount       NUMERIC(10,2) NOT NULL,
    type         payment_type NOT NULL,
    method       payment_method NOT NULL DEFAULT 'cash',
    collected_by UUID NOT NULL REFERENCES users(id),
    paid_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE booking_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id  UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    item_name   VARCHAR(100) NOT NULL,
    quantity    INT NOT NULL DEFAULT 1,
    unit_price  NUMERIC(10,2) NOT NULL,
    total_price NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    added_by    UUID NOT NULL REFERENCES users(id),
    added_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE VIEW booking_balances AS
SELECT
    b.id AS booking_id,
    b.total_amount + COALESCE(items.items_total, 0)  AS total_due,
    COALESCE(pay.total_paid, 0)                       AS total_paid,
    (b.total_amount + COALESCE(items.items_total, 0))
        - COALESCE(pay.total_paid, 0)                 AS balance_due
FROM bookings b
LEFT JOIN (
    SELECT booking_id, SUM(total_price) AS items_total
    FROM booking_items GROUP BY booking_id
) items ON items.booking_id = b.id
LEFT JOIN (
    SELECT booking_id, SUM(amount) AS total_paid
    FROM payments GROUP BY booking_id
) pay ON pay.booking_id = b.id;

CREATE INDEX idx_bookings_date    ON bookings(booking_date);
CREATE INDEX idx_bookings_status  ON bookings(status);
CREATE INDEX idx_bookings_phone   ON bookings(customer_phone);
CREATE INDEX idx_bookings_court   ON bookings(court_id);
CREATE INDEX idx_payments_booking ON payments(booking_id);

WITH v AS (
    INSERT INTO venues (name) VALUES ('Main Ground') RETURNING id
)
INSERT INTO courts (venue_id, name) SELECT id, 'Court 1' FROM v;
