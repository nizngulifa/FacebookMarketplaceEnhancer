-- 1) Connectivity check
SELECT 1 AS ok;

-- 2) Confirm base tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('chats', 'messages')
ORDER BY table_name;

-- 3) Count rows
SELECT
  (SELECT COUNT(*) FROM chats) AS chat_count,
  (SELECT COUNT(*) FROM messages) AS message_count;

-- 4) Typical chat -> messages fetch
SELECT
  c.id AS chat_id,
  c.description,
  m.id AS message_id,
  m.content,
  m.created_at
FROM chats c
LEFT JOIN messages m ON m.chat_id = c.id
ORDER BY c.created_at DESC, m.created_at ASC;
