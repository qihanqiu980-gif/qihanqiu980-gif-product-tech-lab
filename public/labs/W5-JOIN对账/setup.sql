DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS order_items;

CREATE TABLE users (user_id TEXT PRIMARY KEY, signup_channel TEXT, is_test INTEGER);
CREATE TABLE orders (order_id TEXT PRIMARY KEY, user_id TEXT, status TEXT, paid_amount REAL, paid_at TEXT);
CREATE TABLE order_items (item_id TEXT PRIMARY KEY, order_id TEXT, sku TEXT, quantity INTEGER, item_amount REAL);

INSERT INTO users VALUES
('U01','app',0),('U02','web',0),('U03','miniapp',0),('U04','app',0),('U05','web',0),('UT','app',1);

INSERT INTO orders VALUES
('O01','U01','paid',100,'2026-09-14 09:00:00'),
('O02','U02','paid',200,'2026-09-14 10:00:00'),
('O03','U02','paid',80, '2026-09-14 11:00:00'),
('O04','U03','refunded',150,'2026-09-14 12:00:00'),
('O05','U99','paid',60, '2026-09-14 13:00:00'),
('OT','UT','paid',9999,'2026-09-14 14:00:00');

INSERT INTO order_items VALUES
('I01','O01','A',1,40),('I02','O01','B',2,60),
('I03','O02','A',1,100),('I04','O02','C',1,100),
('I05','O03','D',1,80),
('I06','O04','E',3,150),
('I07','O05','F',1,60),
('I08','MISSING','G',1,20),
('I09','OT','A',1,9999);
