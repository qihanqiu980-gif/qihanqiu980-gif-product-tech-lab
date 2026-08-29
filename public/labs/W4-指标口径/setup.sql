DROP TABLE IF EXISTS events;
CREATE TABLE events (
  event_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_time TEXT NOT NULL,
  order_id TEXT,
  amount REAL,
  is_test INTEGER NOT NULL DEFAULT 0
);

INSERT INTO events VALUES
('E01','U01','coupon_exposure','2026-09-07 09:00:00',NULL,NULL,0),
('E02','U01','checkout_view',  '2026-09-07 09:05:00','O01',89,0),
('E03','U01','payment_success','2026-09-07 09:12:00','O01',89,0),
('E04','U02','coupon_exposure','2026-09-07 09:10:00',NULL,NULL,0),
('E05','U02','checkout_view',  '2026-09-07 09:30:00','O02',129,0),
('E06','U02','payment_failed', '2026-09-07 09:35:00','O02',129,0),
('E07','U03','coupon_exposure','2026-09-07 10:00:00',NULL,NULL,0),
('E08','U03','checkout_view',  '2026-09-07 10:01:00','O03',59,0),
('E09','U03','payment_success','2026-09-08 11:00:00','O03',59,0),
('E10','U04','coupon_exposure','2026-09-07 10:30:00',NULL,NULL,0),
('E11','U05','coupon_exposure','2026-09-07 11:00:00',NULL,NULL,0),
('E12','U05','checkout_view',  '2026-09-07 11:05:00','O05',199,0),
('E13','U05','payment_success','2026-09-07 11:20:00','O05',199,0),
('E14','U05','payment_success','2026-09-07 11:20:01','O05',199,0),
('E15','U06','coupon_exposure','2026-09-07 12:00:00',NULL,NULL,0),
('E16','U06','checkout_view',  '2026-09-07 12:10:00','O06',9999,0),
('E17','U06','payment_success','2026-09-07 12:15:00','O06',9999,0),
('E18','U07','coupon_exposure','2026-09-07 13:00:00',NULL,NULL,0),
('E19','U08','coupon_exposure','2026-09-07 13:30:00',NULL,NULL,0),
('E20','U08','checkout_view',  '2026-09-07 13:45:00','O08',79,0),
('E21','U09','coupon_exposure','2026-09-07 14:00:00',NULL,NULL,0),
('E22','U09','checkout_view',  '2026-09-07 14:10:00','O09',39,0),
('E23','U09','payment_success','2026-09-07 15:00:00','O09',39,0),
('E24','U10','coupon_exposure','2026-09-07 15:00:00',NULL,NULL,0),
('E25','TEST','coupon_exposure','2026-09-07 15:30:00',NULL,NULL,1),
('E26','TEST','checkout_view',  '2026-09-07 15:31:00','OT',1,1),
('E27','TEST','payment_success','2026-09-07 15:32:00','OT',1,1);
