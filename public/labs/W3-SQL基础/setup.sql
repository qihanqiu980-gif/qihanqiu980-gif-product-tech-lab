DROP TABLE IF EXISTS orders;

CREATE TABLE orders (
  row_id INTEGER PRIMARY KEY,
  order_id TEXT NOT NULL,
  user_id TEXT,
  status TEXT NOT NULL,
  coupon_type TEXT,
  channel TEXT NOT NULL,
  paid_amount REAL,
  paid_at TEXT,
  is_test INTEGER NOT NULL DEFAULT 0
);

INSERT INTO orders VALUES
  (1,  'O1001', 'U001', 'paid',     'new_user', 'app',     89.00,  '2026-08-31 00:15:12', 0),
  (2,  'O1002', 'U002', 'paid',     NULL,       'web',    129.00,  '2026-08-31 01:03:45', 0),
  (3,  'O1003', 'U003', 'cancelled','new_user', 'app',     59.00,  NULL,                  0),
  (4,  'O1004', 'U001', 'paid',     'new_user', 'app',     39.00,  '2026-08-31 08:20:01', 0),
  (5,  'O1005', 'U004', 'refunded', 'new_user', 'miniapp',199.00,  '2026-08-31 09:10:00', 0),
  (6,  'O1006', 'U005', 'paid',     'new_user', 'miniapp', 79.50,  '2026-08-31 10:05:33', 0),
  (7,  'O1007', 'U006', 'paid',     NULL,       'app',    259.00,  '2026-08-31 11:42:08', 0),
  (8,  'O1008', 'U007', 'paid',     'new_user', 'web',      0.00,  '2026-08-31 12:11:09', 0),
  (9,  'O1009', 'TEST1','paid',     'new_user', 'app',   9999.00,  '2026-08-31 12:30:00', 1),
  (10, 'O1010', 'U008', 'pending',  'new_user', 'web',     49.00,  NULL,                  0),
  (11, 'O1011', 'U009', 'paid',     'new_user', 'app',    119.00,  '2026-08-31 14:18:27', 0),
  (12, 'O1012', 'U010', 'paid',     NULL,       'miniapp', 69.00,  '2026-08-31 18:01:01', 0),
  (13, 'O1013', 'U011', 'paid',     'new_user', 'web',    159.00,  '2026-08-31 22:59:59', 0),
  (14, 'O1014', 'U012', 'paid',     'new_user', 'app',    209.00,  '2026-09-01 00:00:00', 0),
  (15, 'O1015', 'U013', 'paid',     'new_user', 'app',     99.00,  '2026-08-30 23:59:59', 0),
  (16, 'O1016', NULL,   'paid',     'new_user', 'web',     66.00,  '2026-08-31 20:20:20', 0),
  (17, 'O1017', 'U014', 'paid',     'new_user', 'app',     NULL,   '2026-08-31 21:11:11', 0),
  (18, 'O1018', 'U015', 'paid',     'new_user', 'miniapp', 89.00,  '2026-08-31 23:30:30', 0),
  (19, 'O1018', 'U015', 'paid',     'new_user', 'miniapp', 89.00,  '2026-08-31 23:30:30', 0),
  (20, 'O1019', 'U016', 'paid',     NULL,       'web',    139.00,  '2026-09-01 09:10:00', 0);
