BEGIN;

DO $$
DECLARE
  v_org_id int;
  v_admin_id int;
  v_password text;
  v_event_id int;
  v_age_group_id int;
  v_skills_block_id int;
  v_game_block_id int;
  v_skills_session_id int;
  v_game_one_session_id int;
  v_game_two_session_id int;
  v_scorer_one_id int;
  v_scorer_two_id int;
  v_scorer_three_id int;
BEGIN
  SELECT id INTO v_org_id
  FROM organizations
  WHERE subdomain = 'weymouth'
  ORDER BY id
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Seed requires the default Weymouth organization.';
  END IF;

  SELECT id, password INTO v_admin_id, v_password
  FROM users
  WHERE organization_id = v_org_id AND email = 'admin@tryouts.local'
  ORDER BY id
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Seed requires admin@tryouts.local.';
  END IF;

  DELETE FROM audit_log
  WHERE organization_id = v_org_id
    AND details @> '{"simulation":"mite-60-skater"}'::jsonb;

  DELETE FROM tryout_events
  WHERE organization_id = v_org_id
    AND name = 'Mite 60-Skater Simulation';

  DELETE FROM player_event_registrations
  WHERE player_id IN (
    SELECT id FROM players
    WHERE organization_id = v_org_id
      AND external_id LIKE 'SIM-MITE-%'
  );

  DELETE FROM players
  WHERE organization_id = v_org_id
    AND external_id LIKE 'SIM-MITE-%';

  DELETE FROM age_groups
  WHERE organization_id = v_org_id
    AND code = 'MITE-SIM'
    AND NOT EXISTS (
      SELECT 1
      FROM player_event_registrations per
      WHERE per.age_group_id = age_groups.id
    );

  INSERT INTO users (organization_id, email, password, first_name, last_name, role)
  VALUES
    (v_org_id, 'mite-coach-1@tryouts.local', v_password, 'Mite', 'Evaluator 1', 'scorer'),
    (v_org_id, 'mite-coach-2@tryouts.local', v_password, 'Mite', 'Evaluator 2', 'scorer'),
    (v_org_id, 'mite-coach-3@tryouts.local', v_password, 'Mite', 'Evaluator 3', 'scorer')
  ON CONFLICT (email, organization_id) DO UPDATE
    SET first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = EXCLUDED.role,
        updated_at = NOW();

  SELECT id INTO v_scorer_one_id FROM users WHERE organization_id = v_org_id AND email = 'mite-coach-1@tryouts.local';
  SELECT id INTO v_scorer_two_id FROM users WHERE organization_id = v_org_id AND email = 'mite-coach-2@tryouts.local';
  SELECT id INTO v_scorer_three_id FROM users WHERE organization_id = v_org_id AND email = 'mite-coach-3@tryouts.local';

  INSERT INTO age_groups (organization_id, name, code, sort_order)
  VALUES (v_org_id, 'Mite Simulation', 'MITE-SIM', 5)
  ON CONFLICT (code, organization_id) DO UPDATE
    SET name = EXCLUDED.name,
        sort_order = EXCLUDED.sort_order
  RETURNING id INTO v_age_group_id;

  INSERT INTO tryout_events (organization_id, name, season, start_date, end_date)
  VALUES (v_org_id, 'Mite 60-Skater Simulation', '2026-2027', '2026-06-07', '2026-06-08')
  RETURNING id INTO v_event_id;

  INSERT INTO session_blocks (event_id, age_group_id, block_type, split_method, label, session_date, scoring_mode)
  VALUES (v_event_id, v_age_group_id, 'skills', 'none', 'Mite skills evaluation', '2026-06-07', 'full')
  RETURNING id INTO v_skills_block_id;

  INSERT INTO session_blocks (event_id, age_group_id, block_type, split_method, label, session_date, team_count, scoring_mode)
  VALUES (v_event_id, v_age_group_id, 'game', 'manual', 'Mite game evaluation', '2026-06-08', 4, 'full')
  RETURNING id INTO v_game_block_id;

  INSERT INTO game_teams (block_id, team_number, jersey_color, label)
  VALUES
    (v_game_block_id, 1, 'Black', 'Black'),
    (v_game_block_id, 2, 'Gold', 'Gold'),
    (v_game_block_id, 3, 'White', 'White'),
    (v_game_block_id, 4, 'Maroon', 'Maroon');

  INSERT INTO sessions (organization_id, name, event_id, age_group_id, block_id, session_date, start_time, status, session_type)
  VALUES (v_org_id, 'Mite Skills - All Skaters', v_event_id, v_age_group_id, v_skills_block_id, '2026-06-07', '08:00:00', 'complete', 'skills')
  RETURNING id INTO v_skills_session_id;

  INSERT INTO sessions (organization_id, name, event_id, age_group_id, block_id, session_date, start_time, status, session_type, home_team, away_team)
  VALUES (v_org_id, 'Mite Game 1 - Black vs Gold', v_event_id, v_age_group_id, v_game_block_id, '2026-06-08', '08:00:00', 'complete', 'game', 1, 2)
  RETURNING id INTO v_game_one_session_id;

  INSERT INTO sessions (organization_id, name, event_id, age_group_id, block_id, session_date, start_time, status, session_type, home_team, away_team)
  VALUES (v_org_id, 'Mite Game 2 - White vs Maroon', v_event_id, v_age_group_id, v_game_block_id, '2026-06-08', '09:10:00', 'complete', 'game', 3, 4)
  RETURNING id INTO v_game_two_session_id;

  INSERT INTO players (
    organization_id, first_name, last_name, birth_year, date_of_birth, gender,
    external_id, shot, jersey_number, age_group_id, event_id, position, will_tryout
  )
  SELECT
    v_org_id,
    'Mite' || gs,
    CASE (gs % 12)
      WHEN 0 THEN 'Anderson'
      WHEN 1 THEN 'Baker'
      WHEN 2 THEN 'Chen'
      WHEN 3 THEN 'Diaz'
      WHEN 4 THEN 'Evans'
      WHEN 5 THEN 'Foster'
      WHEN 6 THEN 'Garcia'
      WHEN 7 THEN 'Hughes'
      WHEN 8 THEN 'Iverson'
      WHEN 9 THEN 'Johnson'
      WHEN 10 THEN 'Klein'
      ELSE 'Lopez'
    END || gs,
    CASE WHEN gs <= 30 THEN 2018 ELSE 2019 END,
    DATE '2018-01-01' + ((gs % 720) || ' days')::interval,
    CASE WHEN gs % 7 = 0 THEN 'F' ELSE 'M' END,
    'SIM-MITE-' || lpad(gs::text, 3, '0'),
    CASE WHEN gs % 3 = 0 THEN 'L' ELSE 'R' END,
    gs,
    v_age_group_id,
    v_event_id,
    CASE WHEN gs % 5 IN (0, 1) THEN 'defense' ELSE 'forward' END,
    true
  FROM generate_series(1, 60) AS gs;

  INSERT INTO player_event_registrations (
    player_id, event_id, age_group_id, jersey_number, position, shot, will_tryout
  )
  SELECT id, v_event_id, v_age_group_id, jersey_number, position, shot, true
  FROM players
  WHERE organization_id = v_org_id
    AND external_id LIKE 'SIM-MITE-%';

  INSERT INTO session_players (
    session_id, player_id, registration_id, team_number, checked_in, checked_in_at, attendance_status
  )
  SELECT
    s.session_id,
    p.id,
    per.id,
    CASE
      WHEN s.session_id = v_skills_session_id THEN NULL
      WHEN s.session_id = v_game_one_session_id THEN CASE WHEN p.jersey_number <= 30 THEN 1 ELSE 2 END
      ELSE CASE
        WHEN p.jersey_number IN (8, 14, 22, 31, 37, 44) THEN 3
        WHEN p.jersey_number IN (5, 18, 27, 34, 42, 55) THEN 4
        WHEN p.jersey_number <= 30 THEN 4
        ELSE 3
      END
    END,
    p.jersey_number NOT IN (7, 13, 29, 41, 52, 60),
    CASE WHEN p.jersey_number NOT IN (7, 13, 29, 41, 52, 60) THEN NOW() - interval '2 hours' ELSE NULL END,
    CASE
      WHEN p.jersey_number IN (7, 29, 52) THEN 'no_show'
      WHEN p.jersey_number IN (13, 41, 60) THEN 'excused'
      WHEN p.jersey_number IN (11, 23, 45) THEN 'late_arrival'
      ELSE 'checked_in'
    END
  FROM players p
  JOIN player_event_registrations per ON per.player_id = p.id AND per.event_id = v_event_id
  CROSS JOIN (
    VALUES (v_skills_session_id), (v_game_one_session_id), (v_game_two_session_id)
  ) AS s(session_id)
  WHERE p.organization_id = v_org_id
    AND p.external_id LIKE 'SIM-MITE-%';

  INSERT INTO session_scorers (session_id, user_id)
  SELECT s.session_id, u.user_id
  FROM (
    VALUES (v_skills_session_id), (v_game_one_session_id), (v_game_two_session_id)
  ) AS s(session_id)
  CROSS JOIN (
    VALUES (v_scorer_one_id), (v_scorer_two_id), (v_scorer_three_id)
  ) AS u(user_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO scores (
    session_id, player_id, registration_id, scorer_id,
    skating, puck_skills, hockey_sense, notes, status, submitted_at
  )
  SELECT
    sp.session_id,
    sp.player_id,
    sp.registration_id,
    ss.user_id,
    GREATEST(1, LEAST(5, 2 + ((p.jersey_number + sp.session_id + ss.user_id) % 4)))::smallint,
    GREATEST(1, LEAST(5, 2 + ((p.jersey_number * 2 + sp.session_id + ss.user_id) % 4)))::smallint,
    GREATEST(1, LEAST(5, 2 + ((p.jersey_number * 3 + sp.session_id + ss.user_id) % 4)))::smallint,
    CASE
      WHEN p.jersey_number % 10 = 0 THEN 'Strong compete level; consider higher roster.'
      WHEN p.jersey_number % 9 = 0 THEN 'Needs puck support reminders.'
      WHEN p.jersey_number % 8 = 0 THEN 'Good pace in transition.'
      ELSE NULL
    END,
    'submitted',
    NOW() - interval '30 minutes'
  FROM session_players sp
  JOIN players p ON p.id = sp.player_id
  JOIN session_scorers ss ON ss.session_id = sp.session_id
  WHERE sp.checked_in = true
    AND sp.session_id IN (v_skills_session_id, v_game_one_session_id, v_game_two_session_id)
  ON CONFLICT (session_id, player_id, scorer_id) DO UPDATE
    SET registration_id = EXCLUDED.registration_id,
        skating = EXCLUDED.skating,
        puck_skills = EXCLUDED.puck_skills,
        hockey_sense = EXCLUDED.hockey_sense,
        notes = EXCLUDED.notes,
        status = EXCLUDED.status,
        submitted_at = EXCLUDED.submitted_at,
        updated_at = NOW();

  WITH ranked AS (
    SELECT
      per.id,
      ntile(3) OVER (ORDER BY AVG((sc.skating + sc.puck_skills + sc.hockey_sense) / 3.0) DESC, per.jersey_number) AS tier
    FROM player_event_registrations per
    LEFT JOIN scores sc ON sc.registration_id = per.id
    WHERE per.event_id = v_event_id
    GROUP BY per.id, per.jersey_number
  )
  UPDATE player_event_registrations per
  SET outcome = CASE ranked.tier
    WHEN 1 THEN 'moved_up'
    WHEN 2 THEN 'retained'
    ELSE 'left_program'
  END
  FROM ranked
  WHERE ranked.id = per.id;

  INSERT INTO audit_log (organization_id, event, user_id, details)
  VALUES
    (v_org_id, 'player_moved', v_admin_id, jsonb_build_object(
      'simulation', 'mite-60-skater',
      'reason', 'game_two_rebalance',
      'playersMoved', ARRAY[5,8,14,18,22,27,31,34,37,42,44,55],
      'fromSessionId', v_game_one_session_id,
      'toSessionId', v_game_two_session_id
    )),
    (v_org_id, 'import_committed', v_admin_id, jsonb_build_object(
      'simulation', 'mite-60-skater',
      'eventId', v_event_id,
      'ageGroupId', v_age_group_id,
      'players', 60,
      'checkedInPerSession', 54,
      'uncheckedPerSession', 6,
      'sessions', ARRAY[v_skills_session_id, v_game_one_session_id, v_game_two_session_id]
    ));

  RAISE NOTICE 'Mite simulation seeded: event %, age group %, sessions [%, %, %]',
    v_event_id, v_age_group_id, v_skills_session_id, v_game_one_session_id, v_game_two_session_id;
END $$;

COMMIT;
