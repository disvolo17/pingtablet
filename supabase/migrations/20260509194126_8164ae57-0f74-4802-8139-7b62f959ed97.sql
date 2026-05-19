-- More customization items for the racket system
INSERT INTO public.racket_items (code, name, category, rarity, price, unlock_condition, material_params, effect_params, preview_color, sort_order) VALUES
-- BLADES
('blade_titanium', 'Титан', 'blade', 'epic', 12, '{"type":"free"}'::jsonb, '{"color":"#b8c1cc","metalness":0.95,"roughness":0.18,"trim":"#dde3ea"}'::jsonb, '{}'::jsonb, '#b8c1cc', 210),
('blade_obsidian', 'Обсидиан', 'blade', 'epic', 14, '{"type":"free"}'::jsonb, '{"color":"#15161a","metalness":0.6,"roughness":0.15,"emissive":"#3a3a45","emissiveIntensity":0.25}'::jsonb, '{}'::jsonb, '#15161a', 211),
('blade_rosewood', 'Розовое дерево', 'blade', 'rare', 8, '{"type":"free"}'::jsonb, '{"color":"#7a3a2a","metalness":0.05,"roughness":0.55}'::jsonb, '{}'::jsonb, '#7a3a2a', 212),
('blade_emerald', 'Изумруд', 'blade', 'legendary', 28, '{"type":"free"}'::jsonb, '{"color":"#0f5d3a","metalness":0.85,"roughness":0.18,"emissive":"#1ea96d","emissiveIntensity":0.4,"trim":"#d4af37"}'::jsonb, '{}'::jsonb, '#0f5d3a', 213),
('blade_ruby', 'Рубин', 'blade', 'legendary', 30, '{"type":"free"}'::jsonb, '{"color":"#7a0d24","metalness":0.85,"roughness":0.18,"emissive":"#e11d48","emissiveIntensity":0.45,"trim":"#d4af37"}'::jsonb, '{}'::jsonb, '#7a0d24', 214),
('blade_sapphire', 'Сапфир', 'blade', 'legendary', 30, '{"type":"free"}'::jsonb, '{"color":"#0b2a6b","metalness":0.85,"roughness":0.16,"emissive":"#3b82f6","emissiveIntensity":0.45,"trim":"#dde3ea"}'::jsonb, '{}'::jsonb, '#0b2a6b', 215),
('blade_platinum', 'Платина', 'blade', 'mythic', 45, '{"type":"free"}'::jsonb, '{"color":"#e7eaf0","metalness":1.0,"roughness":0.06,"trim":"#ffffff"}'::jsonb, '{}'::jsonb, '#e7eaf0', 216),
('blade_void', 'Бездна', 'blade', 'mythic', 60, '{"type":"free"}'::jsonb, '{"color":"#05060a","metalness":0.4,"roughness":0.1,"emissive":"#7c3aed","emissiveIntensity":0.6,"trim":"#a855f7"}'::jsonb, '{}'::jsonb, '#05060a', 217),

-- RUBBERS
('rubber_orange', 'Оранжевый', 'rubber', 'common', 4, '{"type":"free"}'::jsonb, '{"color":"#f97316","metalness":0.1,"roughness":0.55}'::jsonb, '{}'::jsonb, '#f97316', 320),
('rubber_white', 'Снежный', 'rubber', 'common', 4, '{"type":"free"}'::jsonb, '{"color":"#f5f6f8","metalness":0.1,"roughness":0.5}'::jsonb, '{}'::jsonb, '#f5f6f8', 321),
('rubber_yellow', 'Лимон', 'rubber', 'common', 4, '{"type":"free"}'::jsonb, '{"color":"#facc15","metalness":0.1,"roughness":0.55}'::jsonb, '{}'::jsonb, '#facc15', 322),
('rubber_emerald', 'Изумрудный', 'rubber', 'rare', 7, '{"type":"free"}'::jsonb, '{"color":"#10b981","metalness":0.2,"roughness":0.45,"emissive":"#10b981","emissiveIntensity":0.2}'::jsonb, '{}'::jsonb, '#10b981', 323),
('rubber_magenta', 'Маджента', 'rubber', 'rare', 7, '{"type":"free"}'::jsonb, '{"color":"#d946ef","metalness":0.2,"roughness":0.45,"emissive":"#d946ef","emissiveIntensity":0.25}'::jsonb, '{}'::jsonb, '#d946ef', 324),
('rubber_carbon', 'Карбон', 'rubber', 'epic', 14, '{"type":"free"}'::jsonb, '{"color":"#1a1d22","metalness":0.7,"roughness":0.3,"emissive":"#0ea5e9","emissiveIntensity":0.18}'::jsonb, '{}'::jsonb, '#1a1d22', 325),
('rubber_mirror', 'Зеркало', 'rubber', 'epic', 18, '{"type":"free"}'::jsonb, '{"color":"#cfd6df","metalness":1.0,"roughness":0.05}'::jsonb, '{}'::jsonb, '#cfd6df', 326),
('rubber_gold', 'Золотая накладка', 'rubber', 'legendary', 26, '{"type":"free"}'::jsonb, '{"color":"#d4af37","metalness":1.0,"roughness":0.18,"emissive":"#d4af37","emissiveIntensity":0.25}'::jsonb, '{}'::jsonb, '#d4af37', 327),
('rubber_galaxy', 'Галактика', 'rubber', 'mythic', 40, '{"type":"free"}'::jsonb, '{"color":"#1e1b4b","metalness":0.6,"roughness":0.25,"emissive":"#7c3aed","emissiveIntensity":0.6}'::jsonb, '{"animated":true}'::jsonb, '#1e1b4b', 328),

-- HANDLES
('handle_walnut', 'Орех', 'handle', 'common', 3, '{"type":"free"}'::jsonb, '{"color":"#5a3a26","metalness":0.05,"roughness":0.6}'::jsonb, '{}'::jsonb, '#5a3a26', 420),
('handle_ebony', 'Эбен', 'handle', 'rare', 7, '{"type":"free"}'::jsonb, '{"color":"#1c1a18","metalness":0.1,"roughness":0.45,"trim":"#d4af37"}'::jsonb, '{}'::jsonb, '#1c1a18', 421),
('handle_carbon_red', 'Карбон с красным трим', 'handle', 'epic', 12, '{"type":"free"}'::jsonb, '{"color":"#15171b","metalness":0.7,"roughness":0.28,"trim":"#e11d48"}'::jsonb, '{}'::jsonb, '#15171b', 422),
('handle_chrome', 'Хром', 'handle', 'epic', 16, '{"type":"free"}'::jsonb, '{"color":"#cfd6df","metalness":1.0,"roughness":0.08,"trim":"#ffffff"}'::jsonb, '{}'::jsonb, '#cfd6df', 423),
('handle_neon_grip', 'Неоновый грип', 'handle', 'legendary', 24, '{"type":"free"}'::jsonb, '{"color":"#0b0c10","metalness":0.4,"roughness":0.3,"emissive":"#22d3ee","emissiveIntensity":0.5,"trim":"#22d3ee"}'::jsonb, '{}'::jsonb, '#0b0c10', 424),
('handle_royal', 'Королевский', 'handle', 'mythic', 38, '{"type":"free"}'::jsonb, '{"color":"#1b0f3a","metalness":0.85,"roughness":0.18,"emissive":"#a855f7","emissiveIntensity":0.45,"trim":"#d4af37"}'::jsonb, '{}'::jsonb, '#1b0f3a', 425),

-- EFFECTS
('effect_blue_glow', 'Синее свечение', 'effect', 'rare', 8, '{"type":"free"}'::jsonb, '{}'::jsonb, '{"kind":"glow","color":"#3b82f6"}'::jsonb, '#3b82f6', 520),
('effect_red_glow', 'Багровое свечение', 'effect', 'rare', 8, '{"type":"free"}'::jsonb, '{}'::jsonb, '{"kind":"glow","color":"#ef4444"}'::jsonb, '#ef4444', 521),
('effect_emerald_aura', 'Изумрудная аура', 'effect', 'epic', 18, '{"type":"free"}'::jsonb, '{}'::jsonb, '{"kind":"aura","color":"#10b981"}'::jsonb, '#10b981', 522),
('effect_snow', 'Снежные искры', 'effect', 'epic', 16, '{"type":"free"}'::jsonb, '{}'::jsonb, '{"kind":"particles","color":"#e5f6ff","count":50}'::jsonb, '#e5f6ff', 523),
('effect_ember', 'Угли', 'effect', 'epic', 16, '{"type":"free"}'::jsonb, '{}'::jsonb, '{"kind":"particles","color":"#fb923c","count":40}'::jsonb, '#fb923c', 524),
('effect_holo_pink', 'Голограмма Pink', 'effect', 'legendary', 28, '{"type":"free"}'::jsonb, '{}'::jsonb, '{"kind":"holographic","color":"#ec4899"}'::jsonb, '#ec4899', 525),
('effect_void_aura', 'Аура Бездны', 'effect', 'mythic', 50, '{"type":"free"}'::jsonb, '{}'::jsonb, '{"kind":"aura","color":"#7c3aed"}'::jsonb, '#7c3aed', 526),

-- STICKERS
('sticker_fire', 'Огонь', 'sticker', 'common', 3, '{"type":"free"}'::jsonb, '{}'::jsonb, '{"emoji":"🔥"}'::jsonb, '#f97316', 620),
('sticker_star', 'Звезда', 'sticker', 'common', 3, '{"type":"free"}'::jsonb, '{}'::jsonb, '{"emoji":"⭐"}'::jsonb, '#facc15', 621),
('sticker_lightning', 'Молния', 'sticker', 'rare', 6, '{"type":"free"}'::jsonb, '{}'::jsonb, '{"emoji":"⚡"}'::jsonb, '#facc15', 622),
('sticker_rocket', 'Ракета', 'sticker', 'rare', 6, '{"type":"free"}'::jsonb, '{}'::jsonb, '{"emoji":"🚀"}'::jsonb, '#94a3b8', 623),
('sticker_heart', 'Сердце', 'sticker', 'common', 3, '{"type":"free"}'::jsonb, '{}'::jsonb, '{"emoji":"❤️"}'::jsonb, '#ef4444', 624),
('sticker_diamond', 'Бриллиант', 'sticker', 'epic', 12, '{"type":"free"}'::jsonb, '{}'::jsonb, '{"emoji":"💎"}'::jsonb, '#38bdf8', 625),
('sticker_skull', 'Череп', 'sticker', 'rare', 6, '{"type":"free"}'::jsonb, '{}'::jsonb, '{"emoji":"💀"}'::jsonb, '#cbd5e1', 626),
('sticker_trophy', 'Трофей', 'sticker', 'legendary', 22, '{"type":"free"}'::jsonb, '{}'::jsonb, '{"emoji":"🏆"}'::jsonb, '#d4af37', 627),
('sticker_dragon', 'Дракон', 'sticker', 'mythic', 36, '{"type":"free"}'::jsonb, '{}'::jsonb, '{"emoji":"🐉"}'::jsonb, '#10b981', 628)
ON CONFLICT (code) DO NOTHING;
