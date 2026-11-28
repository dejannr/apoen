ALTER TABLE daily_puzzle_guesses DROP CONSTRAINT daily_puzzle_guesses_daily_set_id_fkey;
ALTER TABLE daily_puzzle_guesses ADD CONSTRAINT daily_puzzle_guesses_daily_set_id_season_id_fkey FOREIGN KEY (daily_set_id,season_id) REFERENCES daily_sets(id,season_id) ON DELETE RESTRICT ON UPDATE CASCADE;
