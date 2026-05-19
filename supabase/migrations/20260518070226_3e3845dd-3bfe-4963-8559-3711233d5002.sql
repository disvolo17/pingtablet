
-- Backfill helper: ensure every player has a sticker card
CREATE OR REPLACE FUNCTION public.sticker_ensure_all_cards()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  INSERT INTO public.sticker_cards(player_id, rarity, variant, hue)
  SELECT p.id,
    CASE WHEN p.rating < 1000 THEN 'common' WHEN p.rating < 1100 THEN 'rare'
         WHEN p.rating < 1250 THEN 'epic' WHEN p.rating < 1450 THEN 'legendary' ELSE 'mythic' END,
    'normal',
    CASE WHEN p.rating < 1000 THEN 0 WHEN p.rating < 1100 THEN 220
         WHEN p.rating < 1250 THEN 280 WHEN p.rating < 1450 THEN 30 ELSE 340 END
  FROM public.players p
  WHERE NOT EXISTS (SELECT 1 FROM public.sticker_cards sc WHERE sc.player_id = p.id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  -- Remove orphan cards (player deleted)
  DELETE FROM public.sticker_cards sc WHERE NOT EXISTS (SELECT 1 FROM public.players p WHERE p.id = sc.player_id);
  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION public.sticker_ensure_all_cards() TO anon, authenticated;

-- Ensure trigger exists on players to auto-create sticker card
DROP TRIGGER IF EXISTS trg_players_sticker ON public.players;
CREATE TRIGGER trg_players_sticker
  AFTER INSERT ON public.players
  FOR EACH ROW EXECUTE FUNCTION public._on_player_created_sticker();

-- Ensure trigger on matches grants stickers
DROP TRIGGER IF EXISTS trg_matches_sticker ON public.matches;
CREATE TRIGGER trg_matches_sticker
  AFTER INSERT OR UPDATE OF winner_id ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public._sticker_after_match();

-- Admin: grant shards
CREATE OR REPLACE FUNCTION public.admin_sticker_grant_shards(_player_id uuid, _amount int)
RETURNS sticker_wallet
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row public.sticker_wallet;
BEGIN
  IF _amount = 0 THEN RAISE EXCEPTION 'Сумма должна быть ненулевой'; END IF;
  INSERT INTO public.sticker_wallet(owner_id, shards) VALUES (_player_id, GREATEST(0, _amount))
    ON CONFLICT (owner_id) DO UPDATE SET shards = GREATEST(0, sticker_wallet.shards + _amount), updated_at = now()
    RETURNING * INTO v_row;
  RETURN v_row;
END $$;

-- Admin: grant pack (3 random stickers, free)
CREATE OR REPLACE FUNCTION public.admin_sticker_grant_pack(_player_id uuid)
RETURNS SETOF sticker_inventory
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pick text; v_card public.sticker_cards; v_inv public.sticker_inventory;
  v_r float; i int; acc int; pick_idx int;
  rarities text[] := ARRAY['common','rare','epic','legendary','mythic'];
  weights int[] := ARRAY[60,25,10,4,1];
BEGIN
  PERFORM public.sticker_ensure_all_cards();
  FOR i IN 1..3 LOOP
    v_r := random()*100; acc := 0;
    FOR pick_idx IN 1..5 LOOP
      acc := acc + weights[pick_idx]; IF v_r < acc THEN EXIT; END IF;
    END LOOP;
    v_pick := rarities[pick_idx];
    SELECT * INTO v_card FROM public.sticker_cards WHERE rarity = v_pick ORDER BY random() LIMIT 1;
    IF v_card.id IS NULL THEN SELECT * INTO v_card FROM public.sticker_cards ORDER BY random() LIMIT 1; END IF;
    IF v_card.id IS NULL THEN CONTINUE; END IF;
    INSERT INTO public.sticker_inventory(owner_id, card_id, source)
    VALUES (_player_id, v_card.id, 'admin_pack') RETURNING * INTO v_inv;
    RETURN NEXT v_inv;
  END LOOP;
  RETURN;
END $$;

-- Admin: grant specific sticker
CREATE OR REPLACE FUNCTION public.admin_sticker_grant_card(_player_id uuid, _card_id uuid)
RETURNS sticker_inventory
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_inv public.sticker_inventory;
BEGIN
  INSERT INTO public.sticker_inventory(owner_id, card_id, source)
  VALUES (_player_id, _card_id, 'admin') RETURNING * INTO v_inv;
  RETURN v_inv;
END $$;

-- Backfill now
SELECT public.sticker_ensure_all_cards();
