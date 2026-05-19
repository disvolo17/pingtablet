# Журнал наклеек игроков

Полная замена системы кастомизации ракетки на коллекционную механику: каждый игрок — это наклейка с редкостью, которую другие собирают. Наклейки выпадают после матчей и из паков, дубликаты конвертируются в осколки, наклейки можно обменивать. Ручное наклеивание из инвентаря в журнал — главный satisfying-момент.

## 1. Удаление ракетки (код)

Таблицы `racket_items`, `user_racket_inventory`, `user_racket_config` остаются в БД (на случай отката), но удаляются их функции:

- DROP FUNCTION `purchase_racket_item`, `equip_racket_item`, `_on_racket_item_change`, `_on_player_created` (перепишем под стикеры)
- Очистка из `admin-action`: `racket_item_upsert`, `racket_item_delete`, `racket_recompute_points`
- Удаляем файлы: `src/components/racket/*`, `src/lib/racket.ts`, `src/pages/AdminRacket.tsx`
- Убираем роут `/admin/racket` в `App.tsx` и ссылку из `Admin.tsx`
- Убираем секцию ракетки из `Profile.tsx`

`achievement_points` сохраняется и становится валютой паков и осколков. Триггер `_on_achievement_unlock` упрощаем — оставляем только начисление 3 очков.

## 2. Новые таблицы

```sql
-- Каталог наклеек: 1 запись на каждого игрока, авто-генерация триггером
sticker_cards
  id uuid pk
  player_id uuid unique not null  -- references players(id)
  rarity text not null            -- common|rare|epic|legendary|mythic
  variant text not null default 'normal' -- normal|holo|gold|signed
  hue int                         -- цвет рамки
  created_at, updated_at

-- Что лежит в инвентаре (несклеенное + дубликаты)
sticker_inventory
  id uuid pk
  owner_id uuid not null          -- кто владеет
  card_id uuid not null           -- какая наклейка
  source text not null            -- match|pack|trade|grant
  acquired_at timestamptz
  index (owner_id, card_id)

-- Журнал: что наклеено
sticker_journal
  id uuid pk
  owner_id uuid not null
  card_id uuid not null
  placed_at timestamptz
  unique (owner_id, card_id)

-- Осколки (валюта дубликатов) и монеты (валюта паков)
sticker_wallet
  owner_id uuid pk
  shards int default 0
  -- coins = achievement_points.balance (используем существующую)

-- Открытые паки и торги
sticker_packs_opened (лог)
  id, owner_id, opened_at, cards uuid[]

sticker_trades
  id uuid pk
  from_id uuid, to_id uuid
  offered_inventory_id uuid       -- из inventory отправителя
  requested_card_id uuid          -- любой экземпляр этой карточки у получателя
  status text                     -- pending|accepted|declined|cancelled
  created_at, responded_at
```

RLS: SELECT публичный для каталога/журналов (соцэффект — видеть чужие коллекции). Запись только через RPC SECURITY DEFINER.

## 3. RPC

- `sticker_ensure_card(_player_id)` — создаёт `sticker_cards` для игрока, если нет. Редкость считается из rating: <1000 common, <1100 rare, <1250 epic, <1450 legendary, иначе mythic. Variant: 5% holo / 1% gold / 0.2% signed.
- Триггер на INSERT `players` → `sticker_ensure_card`.
- Триггер на UPDATE `matches.winner_id` (только не-bye) → `sticker_grant_match_drop` для обоих игроков (получают карточку соперника).
- `sticker_grant_match_drop(_owner, _opponent)` — INSERT в inventory с source='match'.
- `sticker_place(_inventory_id)` — переносит из inventory в journal. Если уже есть в журнале → ошибка «дубликат».
- `sticker_dust_duplicate(_inventory_id)` — конвертирует дубликат в shards (common=2, rare=5, epic=12, legendary=30, mythic=80; ×2 если holo, ×5 gold, ×10 signed).
- `sticker_buy_pack()` — списывает 10 очков из `achievement_points.balance`, выбирает 3 случайных карточки взвешенно по rarity (60/25/10/4/1), пишет в inventory с source='pack', возвращает массив.
- `sticker_trade_create(_offered_inventory_id, _to_player, _requested_card)` — pending.
- `sticker_trade_respond(_trade_id, _accept bool)` — атомарный обмен (одна карточка за одну) или decline.
- Бэкфилл миграцией: `sticker_ensure_card` для всех существующих players; для каждого завершённого матча создаём inventory-записи у обоих игроков.

## 4. Экраны

### `/journal` (новый, в нав-меню)
- Сетка-альбом: все `sticker_cards` по rarity-секциям + сезонные/турнирные страницы (V1: одна общая страница).
- Слот: либо silhouette с `?`, либо PixelStickerCard с glow по rarity.
- Прогресс-бар сверху: `placed / total`, %, кнопка «Открыть инвентарь».
- Отдельный таб «Чужие журналы» — поиск по handle, просмотр прогресса других игроков.

### Inventory drawer (внутри `/journal`)
- Сетка карточек из `sticker_inventory`, бейдж count для дубликатов.
- Drag & drop: pointer events, `framer-motion` `useDragControls`, при отпускании ищем ближайший пустой слот, snap, sparkle, RPC `sticker_place`. Haptic + звук (WebAudio).
- Контекстное меню на дубликате: «Превратить в осколки» / «Предложить обмен».

### Sticker Drop Overlay (новый компонент, глобальный)
- Подписка realtime на `sticker_inventory` где `owner_id = me`.
- Fullscreen reveal: карточка вылетает, крутится 3D (CSS transform), glow по rarity, надпись «NEW STICKER», прогресс «X / Y собрано», кнопки «В инвентарь» / «Сразу в журнал».
- Заменяет текущий `MatchVictoryOverlay` для дропа, а сам victory-overlay остаётся для рейтинга.

### Pack Shop & Pack Opening
- Кнопка «Открыть пак (10 очков)» в `/journal`.
- Pack Opening overlay: 3 карточки рубашкой вверх, последовательное переворачивание со звуком, glow по rarity, в конце — кнопка «Забрать».

### Trading
- Список входящих/исходящих в `/journal` → таб «Обмены».
- Карточка предложения: моя карта ⇄ их карта, кнопки accept/decline.

## 5. Компоненты

```
src/components/stickers/
  PixelStickerCard.tsx        — пиксель-арт карточка игрока (avatar или generated portrait, рамка по rarity, holo-shader)
  StickerJournalGrid.tsx
  StickerInventoryDrawer.tsx
  StickerDropOverlay.tsx      — глобально в Layout
  StickerPackOpening.tsx
  TradeList.tsx
src/pages/Journal.tsx
src/lib/stickers.ts           — типы, веса, цвета rarity
```

## 6. Реалтайм

- `supabase_realtime` ADD TABLE `sticker_inventory`, `sticker_journal`, `sticker_trades`.
- `StickerDropOverlay` подписан на INSERT inventory (показ дроп-анимации).
- Журнал и инвентарь — invalidate React Query по событиям.

## 7. Визуал

- Pixel-art карточка 3:4, имя в `font-pixel`, аватар в пикселизованном виде (CSS `image-rendering: pixelated` + scale).
- Рамки rarity (HSL): common серый, rare синий 220, epic фиолет 280, legendary оранж 30, mythic малиновый 340.
- Holo: animated conic-gradient overlay с `mix-blend-mode: color-dodge`.
- Gold: золотая рамка + shimmer.
- Signed: подпись поверх карточки.
- Glow → CSS `filter: drop-shadow` с цветом rarity.
- CRT scanlines уже есть в index.css — переиспользуем.

## 8. Технические детали

- Все мутации только через RPC SECURITY DEFINER (`auth.uid()` → `players.id` через существующий `_my_player_id()`).
- Цена пака — 10 единиц `achievement_points.balance`, списание + запись в `point_transactions`.
- Дубликат в инвентаре — это вторая (третья…) запись в `sticker_inventory` той же `card_id`.
- Drag из inventory в journal: один backend вызов, оптимистичный update.
- Существующие очки сохраняются: миграция оставляет `achievement_points` как есть.

## Что НЕ включено в эту итерацию

- Сезонные страницы / event-наклейки (структура card.season добавим позже).
- Сложные shader-эффекты (holo через CSS, без WebGL).
- Звуки — WebAudio тики, без аудиофайлов.
- Push-уведомления о входящих обменах.
