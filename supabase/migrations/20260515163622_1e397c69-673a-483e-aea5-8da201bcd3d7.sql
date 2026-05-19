
-- ============================================================
-- STICKER JOURNAL SYSTEM
-- ============================================================

-- Drop racket trigger/funcs we no longer use (tables left intact)
DROP FUNCTION IF EXISTS public.purchase_racket_item(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.equip_racket_item(uuid, boolean) CASCADE;
DROP FUNCTION IF EXISTS public._on_racket_item_change() CASCADE;
DROP FUNCTION IF EXISTS public._on_player_created() CASCADE;

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE public.sticker_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL UNIQUE,
  rarity text NOT NULL DEFAULT 'common',
  variant text NOT NULL DEFAULT 'normal',
  hue int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sticker_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY sticker_cards_select_all ON public.sticker_cards FOR SELECT USING (true);
CREATE INDEX idx_sticker_cards_rarity ON public.sticker_cards(rarity);

CREATE TABLE public.sticker_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  card_id uuid NOT NULL REFERENCES public.sticker_cards(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'match',
  acquired_at timestamptz NOT NULL DEFAULT now(),
  seen boolean NOT NULL DEFAULT false
);
ALTER TABLE public.sticker_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY sticker_inventory_select_all ON public.sticker_inventory FOR SELECT USING (true);
CREATE INDEX idx_sticker_inv_owner ON public.sticker_inventory(owner_id);
CREATE INDEX idx_sticker_inv_owner_card ON public.sticker_inventory(owner_id, card_id);

CREATE TABLE public.sticker_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  card_id uuid NOT NULL REFERENCES public.sticker_cards(id) ON DELETE CASCADE,
  placed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, card_id)
);
ALTER TABLE public.sticker_journal ENABLE ROW LEVEL SECURITY;
CREATE POLICY sticker_journal_select_all ON public.sticker_journal FOR SELECT USING (true);
CREATE INDEX idx_sticker_journal_owner ON public.sticker_journal(owner_id);

CREATE TABLE public.sticker_wallet (
  owner_id uuid PRIMARY KEY,
  shards int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sticker_wallet ENABLE ROW LEVEL SECURITY;
CREATE POLICY sticker_wallet_select_all ON public.sticker_wallet FOR SELECT USING (true);

CREATE TABLE public.sticker_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_player_id uuid NOT NULL,
  to_player_id uuid NOT NULL,
  offered_inventory_id uuid NOT NULL REFERENCES public.sticker_inventory(id) ON DELETE CASCADE,
  requested_card_id uuid NOT NULL REFERENCES public.sticker_cards(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);
ALTER TABLE public.sticker_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY sticker_trades_select_all ON public.sticker_trades FOR SELECT USING (true);
CREATE INDEX idx_sticker_trades_to ON public.sticker_trades(to_player_id, status);
CREATE INDEX idx_sticker_trades_from ON public.sticker_trades(from_player_id, status);

-- ============================================================
-- RPC: ensure card for player
-- ============================================================

CREATE OR REPLACE FUNCTION public.sticker_ensure_card(_player_id uuid)
RETURNS public.sticker_cards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card public.sticker_cards;
  v_rating int;
  v_rarity text;
  v_variant text;
  v_hue int;
  v_r float;
BEGIN
  SELECT * INTO v_card FROM public.sticker_cards WHERE player_id = _player_id;
  IF FOUND THEN RETURN v_card; END IF;

  SELECT COALESCE(rating, 1000) INTO v_rating FROM public.players WHERE id = _player_id;
  IF v_rating IS NULL THEN RAISE EXCEPTION 'Игрок не найден'; END IF;

  v_rarity := CASE
    WHEN v_rating < 1000 THEN 'common'
    WHEN v_rating < 1100 THEN 'rare'
    WHEN v_rating < 1250 THEN 'epic'
    WHEN v_rating < 1450 THEN 'legendary'
    ELSE 'mythic' END;

  v_r := random();
  v_variant := CASE
    WHEN v_r < 0.002 THEN 'signed'
    WHEN v_r < 0.012 THEN 'gold'
    WHEN v_r < 0.062 THEN 'holo'
    ELSE 'normal' END;

  v_hue := CASE v_rarity
    WHEN 'common' THEN 0
    WHEN 'rare' THEN 220
    WHEN 'epic' THEN 280
    WHEN 'legendary' THEN 30
    WHEN 'mythic' THEN 340 END;

  INSERT INTO public.sticker_cards(player_id, rarity, variant, hue)
  VALUES (_player_id, v_rarity, v_variant, v_hue)
  RETURNING * INTO v_card;
  RETURN v_card;
END $$;

-- Trigger: new player → ensure card
CREATE OR REPLACE FUNCTION public._on_player_created_sticker()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._ensure_points_row(NEW.id);
  PERFORM public.sticker_ensure_card(NEW.id);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_player_created_sticker
AFTER INSERT ON public.players
FOR EACH ROW EXECUTE FUNCTION public._on_player_created_sticker();

-- ============================================================
-- RPC: grant a sticker to inventory (internal)
-- ============================================================

CREATE OR REPLACE FUNCTION public._sticker_grant(_owner uuid, _opponent uuid, _source text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card_id uuid;
  v_inv_id uuid;
BEGIN
  IF _owner IS NULL OR _opponent IS NULL OR _owner = _opponent THEN RETURN NULL; END IF;
  v_card_id := (public.sticker_ensure_card(_opponent)).id;
  INSERT INTO public.sticker_inventory(owner_id, card_id, source)
  VALUES (_owner, v_card_id, _source)
  RETURNING id INTO v_inv_id;
  RETURN v_inv_id;
END $$;

-- Trigger: match completed → drop stickers to both players
CREATE OR REPLACE FUNCTION public._sticker_after_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_bye = true THEN RETURN NEW; END IF;
  IF NEW.winner_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.winner_id IS NOT NULL AND OLD.winner_id IS NOT DISTINCT FROM NEW.winner_id THEN
    RETURN NEW;
  END IF;
  PERFORM public._sticker_grant(NEW.player1_id, NEW.player2_id, 'match');
  PERFORM public._sticker_grant(NEW.player2_id, NEW.player1_id, 'match');
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sticker_after_match
AFTER INSERT OR UPDATE OF winner_id ON public.matches
FOR EACH ROW EXECUTE FUNCTION public._sticker_after_match();

-- ============================================================
-- RPC: place sticker into journal (manual)
-- ============================================================

CREATE OR REPLACE FUNCTION public.sticker_place(_inventory_id uuid)
RETURNS public.sticker_journal
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid uuid := public._my_player_id();
  v_inv public.sticker_inventory;
  v_jrn public.sticker_journal;
BEGIN
  IF v_pid IS NULL THEN RAISE EXCEPTION 'Не авторизован'; END IF;
  SELECT * INTO v_inv FROM public.sticker_inventory WHERE id = _inventory_id;
  IF NOT FOUND OR v_inv.owner_id <> v_pid THEN RAISE EXCEPTION 'Наклейка не найдена'; END IF;
  IF EXISTS(SELECT 1 FROM public.sticker_journal WHERE owner_id = v_pid AND card_id = v_inv.card_id) THEN
    RAISE EXCEPTION 'Эта наклейка уже в журнале — это дубликат';
  END IF;
  INSERT INTO public.sticker_journal(owner_id, card_id) VALUES (v_pid, v_inv.card_id) RETURNING * INTO v_jrn;
  DELETE FROM public.sticker_inventory WHERE id = _inventory_id;
  RETURN v_jrn;
END $$;

-- ============================================================
-- RPC: convert duplicate to shards
-- ============================================================

CREATE OR REPLACE FUNCTION public.sticker_dust_duplicate(_inventory_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid uuid := public._my_player_id();
  v_inv public.sticker_inventory;
  v_card public.sticker_cards;
  v_amt int;
  v_mult int;
BEGIN
  IF v_pid IS NULL THEN RAISE EXCEPTION 'Не авторизован'; END IF;
  SELECT * INTO v_inv FROM public.sticker_inventory WHERE id = _inventory_id;
  IF NOT FOUND OR v_inv.owner_id <> v_pid THEN RAISE EXCEPTION 'Наклейка не найдена'; END IF;
  SELECT * INTO v_card FROM public.sticker_cards WHERE id = v_inv.card_id;

  v_amt := CASE v_card.rarity
    WHEN 'common' THEN 2 WHEN 'rare' THEN 5 WHEN 'epic' THEN 12
    WHEN 'legendary' THEN 30 WHEN 'mythic' THEN 80 ELSE 1 END;
  v_mult := CASE v_card.variant
    WHEN 'holo' THEN 2 WHEN 'gold' THEN 5 WHEN 'signed' THEN 10 ELSE 1 END;
  v_amt := v_amt * v_mult;

  INSERT INTO public.sticker_wallet(owner_id, shards) VALUES (v_pid, v_amt)
    ON CONFLICT (owner_id) DO UPDATE SET shards = sticker_wallet.shards + EXCLUDED.shards, updated_at = now();
  DELETE FROM public.sticker_inventory WHERE id = _inventory_id;
  RETURN v_amt;
END $$;

-- ============================================================
-- RPC: buy a pack (3 random cards) for 10 achievement points
-- ============================================================

CREATE OR REPLACE FUNCTION public.sticker_buy_pack()
RETURNS SETOF public.sticker_inventory
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid uuid := public._my_player_id();
  v_balance int;
  v_price int := 10;
  v_total int;
  v_pick text;
  v_card public.sticker_cards;
  v_inv public.sticker_inventory;
  v_r float;
  i int;
  rarities text[] := ARRAY['common','rare','epic','legendary','mythic'];
  weights int[] := ARRAY[60,25,10,4,1];
  acc int;
  pick_idx int;
BEGIN
  IF v_pid IS NULL THEN RAISE EXCEPTION 'Не авторизован'; END IF;
  PERFORM public._ensure_points_row(v_pid);
  SELECT balance INTO v_balance FROM public.achievement_points WHERE player_id = v_pid;
  IF v_balance < v_price THEN RAISE EXCEPTION 'Недостаточно очков (нужно %)', v_price; END IF;

  -- Make sure every existing player has a card
  INSERT INTO public.sticker_cards(player_id, rarity, variant, hue)
  SELECT p.id,
    CASE WHEN p.rating < 1000 THEN 'common' WHEN p.rating < 1100 THEN 'rare'
         WHEN p.rating < 1250 THEN 'epic' WHEN p.rating < 1450 THEN 'legendary' ELSE 'mythic' END,
    'normal',
    CASE WHEN p.rating < 1000 THEN 0 WHEN p.rating < 1100 THEN 220
         WHEN p.rating < 1250 THEN 280 WHEN p.rating < 1450 THEN 30 ELSE 340 END
  FROM public.players p
  WHERE NOT EXISTS (SELECT 1 FROM public.sticker_cards sc WHERE sc.player_id = p.id);

  UPDATE public.achievement_points
    SET balance = balance - v_price, lifetime_spent = lifetime_spent + v_price
    WHERE player_id = v_pid;
  INSERT INTO public.point_transactions(player_id, delta, reason) VALUES (v_pid, -v_price, 'sticker_pack');

  FOR i IN 1..3 LOOP
    v_r := random() * 100;
    acc := 0;
    pick_idx := 1;
    FOR pick_idx IN 1..5 LOOP
      acc := acc + weights[pick_idx];
      IF v_r < acc THEN EXIT; END IF;
    END LOOP;
    v_pick := rarities[pick_idx];

    SELECT COUNT(*) INTO v_total FROM public.sticker_cards WHERE rarity = v_pick;
    IF v_total = 0 THEN
      SELECT * INTO v_card FROM public.sticker_cards ORDER BY random() LIMIT 1;
    ELSE
      SELECT * INTO v_card FROM public.sticker_cards WHERE rarity = v_pick ORDER BY random() LIMIT 1;
    END IF;
    IF v_card.id IS NULL THEN CONTINUE; END IF;

    INSERT INTO public.sticker_inventory(owner_id, card_id, source)
    VALUES (v_pid, v_card.id, 'pack') RETURNING * INTO v_inv;
    RETURN NEXT v_inv;
  END LOOP;
  RETURN;
END $$;

-- ============================================================
-- RPC: trades
-- ============================================================

CREATE OR REPLACE FUNCTION public.sticker_trade_create(_offered_inventory_id uuid, _to_player uuid, _requested_card uuid)
RETURNS public.sticker_trades
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid uuid := public._my_player_id();
  v_inv public.sticker_inventory;
  v_trade public.sticker_trades;
BEGIN
  IF v_pid IS NULL THEN RAISE EXCEPTION 'Не авторизован'; END IF;
  IF _to_player = v_pid THEN RAISE EXCEPTION 'Нельзя обменяться с собой'; END IF;
  SELECT * INTO v_inv FROM public.sticker_inventory WHERE id = _offered_inventory_id;
  IF NOT FOUND OR v_inv.owner_id <> v_pid THEN RAISE EXCEPTION 'Карточка не найдена'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.sticker_inventory WHERE owner_id = _to_player AND card_id = _requested_card) THEN
    RAISE EXCEPTION 'У игрока нет такой карточки в инвентаре';
  END IF;
  INSERT INTO public.sticker_trades(from_player_id, to_player_id, offered_inventory_id, requested_card_id)
  VALUES (v_pid, _to_player, _offered_inventory_id, _requested_card)
  RETURNING * INTO v_trade;
  RETURN v_trade;
END $$;

CREATE OR REPLACE FUNCTION public.sticker_trade_respond(_trade_id uuid, _accept boolean)
RETURNS public.sticker_trades
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid uuid := public._my_player_id();
  v_t public.sticker_trades;
  v_their_inv public.sticker_inventory;
BEGIN
  IF v_pid IS NULL THEN RAISE EXCEPTION 'Не авторизован'; END IF;
  SELECT * INTO v_t FROM public.sticker_trades WHERE id = _trade_id;
  IF NOT FOUND OR v_t.to_player_id <> v_pid OR v_t.status <> 'pending' THEN
    RAISE EXCEPTION 'Обмен недоступен';
  END IF;

  IF NOT _accept THEN
    UPDATE public.sticker_trades SET status = 'declined', responded_at = now() WHERE id = _trade_id RETURNING * INTO v_t;
    RETURN v_t;
  END IF;

  -- Need to re-check both items still exist
  IF NOT EXISTS(SELECT 1 FROM public.sticker_inventory WHERE id = v_t.offered_inventory_id AND owner_id = v_t.from_player_id) THEN
    RAISE EXCEPTION 'Предложенной карточки больше нет';
  END IF;
  SELECT * INTO v_their_inv FROM public.sticker_inventory
    WHERE owner_id = v_pid AND card_id = v_t.requested_card_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'У тебя больше нет такой карточки'; END IF;

  -- Swap owners
  UPDATE public.sticker_inventory SET owner_id = v_pid, source = 'trade', acquired_at = now()
    WHERE id = v_t.offered_inventory_id;
  UPDATE public.sticker_inventory SET owner_id = v_t.from_player_id, source = 'trade', acquired_at = now()
    WHERE id = v_their_inv.id;

  UPDATE public.sticker_trades SET status = 'accepted', responded_at = now() WHERE id = _trade_id RETURNING * INTO v_t;
  RETURN v_t;
END $$;

CREATE OR REPLACE FUNCTION public.sticker_trade_cancel(_trade_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid uuid := public._my_player_id();
BEGIN
  IF v_pid IS NULL THEN RAISE EXCEPTION 'Не авторизован'; END IF;
  UPDATE public.sticker_trades SET status = 'cancelled', responded_at = now()
    WHERE id = _trade_id AND from_player_id = v_pid AND status = 'pending';
END $$;

-- ============================================================
-- RPC: mark inventory items seen (so drop overlay only fires once)
-- ============================================================

CREATE OR REPLACE FUNCTION public.sticker_mark_seen(_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_pid uuid := public._my_player_id();
BEGIN
  IF v_pid IS NULL THEN RETURN; END IF;
  UPDATE public.sticker_inventory SET seen = true
    WHERE owner_id = v_pid AND id = ANY(_ids);
END $$;

-- ============================================================
-- BACKFILL
-- ============================================================

-- 1) Make sure every player has a card
INSERT INTO public.sticker_cards(player_id, rarity, variant, hue)
SELECT p.id,
  CASE WHEN p.rating < 1000 THEN 'common' WHEN p.rating < 1100 THEN 'rare'
       WHEN p.rating < 1250 THEN 'epic' WHEN p.rating < 1450 THEN 'legendary' ELSE 'mythic' END,
  'normal',
  CASE WHEN p.rating < 1000 THEN 0 WHEN p.rating < 1100 THEN 220
       WHEN p.rating < 1250 THEN 280 WHEN p.rating < 1450 THEN 30 ELSE 340 END
FROM public.players p
WHERE NOT EXISTS (SELECT 1 FROM public.sticker_cards sc WHERE sc.player_id = p.id);

-- 2) For every past completed match, grant inventory cards (mark seen=true to skip drop overlay)
INSERT INTO public.sticker_inventory(owner_id, card_id, source, seen, acquired_at)
SELECT m.player1_id, sc.id, 'match', true, m.created_at
FROM public.matches m
JOIN public.sticker_cards sc ON sc.player_id = m.player2_id
WHERE m.is_bye = false AND m.winner_id IS NOT NULL
  AND m.player1_id IS NOT NULL AND m.player2_id IS NOT NULL
  AND m.player1_id <> m.player2_id;

INSERT INTO public.sticker_inventory(owner_id, card_id, source, seen, acquired_at)
SELECT m.player2_id, sc.id, 'match', true, m.created_at
FROM public.matches m
JOIN public.sticker_cards sc ON sc.player_id = m.player1_id
WHERE m.is_bye = false AND m.winner_id IS NOT NULL
  AND m.player1_id IS NOT NULL AND m.player2_id IS NOT NULL
  AND m.player1_id <> m.player2_id;

-- ============================================================
-- REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.sticker_inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sticker_journal;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sticker_trades;

-- updated_at trigger on sticker_cards
CREATE TRIGGER trg_sticker_cards_touch BEFORE UPDATE ON public.sticker_cards
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
