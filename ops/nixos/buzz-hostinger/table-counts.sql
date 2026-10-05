\pset tuples_only on
\pset format unaligned
SELECT format('SELECT %L AS table_name, count(*) FROM %I.%I;',
              schemaname || '.' || tablename, schemaname, tablename)
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename
\gexec
