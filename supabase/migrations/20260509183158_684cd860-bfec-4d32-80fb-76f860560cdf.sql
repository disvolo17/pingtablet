
-- Catalog of racket items
CREATE TABLE public.racket_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('blade','rubber','handle','effect','sticker')),
  rarity text NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','rare','epic','legendary','mythic')),
  price integer NOT NULL DEFAULT 0,
  unlock_condition jsonb NOT NULL DEFAULT '{"type":"free"}'::jsonb,
  material_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  effect_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  preview_color text NOT NULL DEFAULT '#888888',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.racket_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY racket_items_select_all ON public.racket_items FOR SELECT USING (true);
CREATE TRIGGER tr_racket_items_touch BEFORE UPDATE ON public.racket_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Inventory
CREATE TABLE public.user_racket_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  item_id uuid NOT NULL REFERENCES public.racket_items(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(player_id, item_id)
);
ALTER TABLE public.user_racket_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY uri_select_all ON public.user_racket_inventory FOR SELECT USING (true);
CREATE INDEX idx_uri_player ON public.user_racket_inventory(player_id);

-- Equipped config
CREATE TABLE public.user_racket_config (
  player_id uuid PRIMARY KEY,
  blade_id uuid REFERENCES public.racket_items(id) ON DELETE SET NULL,
  rubber_front_id uuid REFERENCES public.racket_items(id) ON DELETE SET NULL,
  rubber_back_id uuid REFERENCES public.racket_items(id) ON DELETE SET NULL,
  handle_id uuid REFERENCES public.racket_items(id) ON DELETE SET NULL,
  effect_id uuid REFERENCES public.racket_items(id) ON DELETE SET NULL,
  sticker_id uuid REFERENCES public.racket_items(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_racket_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY urc_select_all ON public.user_racket_config FOR SELECT USING (true);
CREATE TRIGGER tr_urc_touch BEFORE UPDATE ON public.user_racket_config FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Points balance
CREATE TABLE public.achievement_points (
  player_id uuid PRIMARY KEY,
  balance integer NOT NULL DEFAULT 0,
  lifetime_earned integer NOT NULL DEFAULT 0,
  lifetime_spent integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.achievement_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY ap_select_all ON public.achievement_points FOR SELECT USING (true);
CREATE TRIGGER tr_ap_touch BEFORE UPDATE ON public.achievement_points FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Transactions
CREATE TABLE public.point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  delta integer NOT NULL,
  reason text NOT NULL,
  ref_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY pt_select_all ON public.point_transactions FOR SELECT USING (true);
CREATE INDEX idx_pt_player_created ON public.point_transactions(player_id, created_at DESC);

-- Helper: ensure points row
CREATE OR REPLACE FUNCTION public._ensure_points_row(_player_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.achievement_points (player_id) VALUES (_player_id)
  ON CONFLICT (player_id) DO NOTHING;
$$;

-- Helper: get my player id
CREATE OR REPLACE FUNCTION public._my_player_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.players WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Trigger: on new achievement -> +3 points + auto-unlock items
CREATE OR REPLACE FUNCTION public._on_achievement_unlock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ach_code text;
BEGIN
  PERFORM public._ensure_points_row(NEW.player_id);
  UPDATE public.achievement_points
    SET balance = balance + 3, lifetime_earned = lifetime_earned + 3
    WHERE player_id = NEW.player_id;
  INSERT INTO public.point_transactions (player_id, delta, reason, ref_id)
  VALUES (NEW.player_id, 3, 'achievement_unlock', NEW.achievement_id);

  SELECT code INTO ach_code FROM public.achievements WHERE id = NEW.achievement_id;

  -- Auto-unlock items gated by this achievement
  IF ach_code IS NOT NULL THEN
    INSERT INTO public.user_racket_inventory (player_id, item_id)
    SELECT NEW.player_id, ri.id
    FROM public.racket_items ri
    WHERE ri.is_active
      AND ri.unlock_condition->>'type' = 'achievement_code'
      AND ri.unlock_condition->>'code' = ach_code
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER tr_ach_unlock_points
AFTER INSERT ON public.user_achievements
FOR EACH ROW EXECUTE FUNCTION public._on_achievement_unlock();

-- Trigger: when a free item is created, grant to all players
CREATE OR REPLACE FUNCTION public._on_racket_item_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_active AND (NEW.unlock_condition->>'type') = 'free' AND NEW.price = 0 THEN
    INSERT INTO public.user_racket_inventory (player_id, item_id)
    SELECT p.id, NEW.id FROM public.players p
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER tr_racket_items_grant_free
AFTER INSERT OR UPDATE ON public.racket_items
FOR EACH ROW EXECUTE FUNCTION public._on_racket_item_change();

-- Trigger: on new player -> ensure points + grant free items
CREATE OR REPLACE FUNCTION public._on_player_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._ensure_points_row(NEW.id);
  INSERT INTO public.user_racket_inventory (player_id, item_id)
  SELECT NEW.id, ri.id FROM public.racket_items ri
  WHERE ri.is_active AND (ri.unlock_condition->>'type') = 'free' AND ri.price = 0
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER tr_players_init_racket
AFTER INSERT ON public.players
FOR EACH ROW EXECUTE FUNCTION public._on_player_created();

-- Backfill points for existing achievements
INSERT INTO public.achievement_points (player_id, balance, lifetime_earned)
SELECT player_id, COUNT(*) * 3, COUNT(*) * 3
FROM public.user_achievements GROUP BY player_id
ON CONFLICT (player_id) DO UPDATE
  SET balance = EXCLUDED.balance, lifetime_earned = EXCLUDED.lifetime_earned;

-- Ensure all players have a points row
INSERT INTO public.achievement_points (player_id)
SELECT id FROM public.players ON CONFLICT DO NOTHING;

-- RPC: purchase
CREATE OR REPLACE FUNCTION public.purchase_racket_item(_item_id uuid)
RETURNS user_racket_inventory LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pid uuid := public._my_player_id();
  v_item public.racket_items;
  v_balance int;
  v_inv public.user_racket_inventory;
  v_unlock_type text;
  v_unlock_code text;
  v_has_ach boolean;
BEGIN
  IF v_pid IS NULL THEN RAISE EXCEPTION 'Не авторизован'; END IF;
  SELECT * INTO v_item FROM public.racket_items WHERE id = _item_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Предмет не найден'; END IF;

  -- Already owned?
  SELECT * INTO v_inv FROM public.user_racket_inventory WHERE player_id = v_pid AND item_id = _item_id;
  IF FOUND THEN RETURN v_inv; END IF;

  v_unlock_type := v_item.unlock_condition->>'type';
  v_unlock_code := v_item.unlock_condition->>'code';

  IF v_unlock_type = 'achievement_code' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.user_achievements ua
      JOIN public.achievements a ON a.id = ua.achievement_id
      WHERE ua.player_id = v_pid AND a.code = v_unlock_code
    ) INTO v_has_ach;
    IF NOT v_has_ach THEN RAISE EXCEPTION 'Сначала получи нужное достижение'; END IF;
  END IF;

  IF v_item.price > 0 THEN
    PERFORM public._ensure_points_row(v_pid);
    SELECT balance INTO v_balance FROM public.achievement_points WHERE player_id = v_pid;
    IF v_balance < v_item.price THEN RAISE EXCEPTION 'Недостаточно очков'; END IF;
    UPDATE public.achievement_points
      SET balance = balance - v_item.price, lifetime_spent = lifetime_spent + v_item.price
      WHERE player_id = v_pid;
    INSERT INTO public.point_transactions (player_id, delta, reason, ref_id)
    VALUES (v_pid, -v_item.price, 'purchase', _item_id);
  END IF;

  INSERT INTO public.user_racket_inventory (player_id, item_id)
  VALUES (v_pid, _item_id) RETURNING * INTO v_inv;
  RETURN v_inv;
END $$;

-- RPC: equip / unequip
CREATE OR REPLACE FUNCTION public.equip_racket_item(_item_id uuid, _equip boolean DEFAULT true)
RETURNS user_racket_config LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pid uuid := public._my_player_id();
  v_item public.racket_items;
  v_cfg public.user_racket_config;
  v_owned boolean;
  v_col text;
BEGIN
  IF v_pid IS NULL THEN RAISE EXCEPTION 'Не авторизован'; END IF;
  SELECT * INTO v_item FROM public.racket_items WHERE id = _item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Предмет не найден'; END IF;

  IF _equip THEN
    SELECT EXISTS(SELECT 1 FROM public.user_racket_inventory WHERE player_id = v_pid AND item_id = _item_id) INTO v_owned;
    IF NOT v_owned THEN RAISE EXCEPTION 'Предмет не разблокирован'; END IF;
  END IF;

  INSERT INTO public.user_racket_config (player_id) VALUES (v_pid) ON CONFLICT DO NOTHING;

  v_col := CASE v_item.category
    WHEN 'blade' THEN 'blade_id'
    WHEN 'rubber' THEN 'rubber_front_id'
    WHEN 'handle' THEN 'handle_id'
    WHEN 'effect' THEN 'effect_id'
    WHEN 'sticker' THEN 'sticker_id'
  END;

  EXECUTE format('UPDATE public.user_racket_config SET %I = $1, updated_at = now() WHERE player_id = $2 RETURNING *', v_col)
    INTO v_cfg USING (CASE WHEN _equip THEN _item_id ELSE NULL END), v_pid;

  -- Mirror rubber to back too for now
  IF v_item.category = 'rubber' THEN
    UPDATE public.user_racket_config SET rubber_back_id = (CASE WHEN _equip THEN _item_id ELSE NULL END)
      WHERE player_id = v_pid RETURNING * INTO v_cfg;
  END IF;

  RETURN v_cfg;
END $$;

GRANT EXECUTE ON FUNCTION public.purchase_racket_item(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equip_racket_item(uuid, boolean) TO authenticated;
