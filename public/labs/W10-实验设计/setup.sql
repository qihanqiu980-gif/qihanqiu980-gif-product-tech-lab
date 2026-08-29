DROP TABLE IF EXISTS experiment_users;
DROP TABLE IF EXISTS events;

CREATE TABLE experiment_users(user_id TEXT PRIMARY KEY, group_name TEXT, assigned_at TEXT, platform TEXT);
CREATE TABLE events(event_id TEXT, user_id TEXT, event_name TEXT, event_time TEXT, order_id TEXT, value REAL);

WITH RECURSIVE seq(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM seq WHERE x<100)
INSERT INTO experiment_users
SELECT printf('U%03d',x), CASE WHEN x<=45 THEN 'A' ELSE 'B' END,
       '2026-10-19 09:00:00', CASE WHEN x%2=0 THEN 'ios' ELSE 'android' END
FROM seq;

INSERT INTO events
SELECT printf('V%03d',x), printf('U%03d',x), 'checkout_view', '2026-10-19 10:00:00', NULL, NULL
FROM (WITH RECURSIVE seq(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM seq WHERE x<90) SELECT x FROM seq);

INSERT INTO events
SELECT printf('P%03d',x), printf('U%03d',x), 'payment_success', '2026-10-19 11:00:00', printf('O%03d',x), 100
FROM (WITH RECURSIVE seq(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM seq WHERE x<30) SELECT x FROM seq);

INSERT INTO events VALUES
('P046','U046','payment_success','2026-10-19 11:00:00','O046',100),
('P047','U047','payment_success','2026-10-19 11:00:00','O047',100),
('P048','U048','payment_success','2026-10-19 11:00:00','O048',100),
('P049','U049','payment_success','2026-10-19 11:00:00','O049',100),
('P050','U050','payment_success','2026-10-19 11:00:00','O050',100),
('P050-DUP','U050','payment_success','2026-10-19 11:00:01','O050',100),
('C046','U046','complaint','2026-10-20 09:00:00',NULL,NULL),
('C047','U047','complaint','2026-10-20 09:00:00',NULL,NULL),
('C048','U048','complaint','2026-10-20 09:00:00',NULL,NULL),
('C049','U049','complaint','2026-10-20 09:00:00',NULL,NULL),
('C001','U001','complaint','2026-10-20 09:00:00',NULL,NULL);
