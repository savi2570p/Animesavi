-- Add is_crunchyroll boolean column to anime table
ALTER TABLE public.anime ADD COLUMN is_crunchyroll boolean NOT NULL DEFAULT false;

-- Seed existing anime titles as crunchyroll
UPDATE public.anime SET is_crunchyroll = true WHERE title ILIKE '%Solo Leveling%'
  OR title ILIKE '%Jujutsu Kaisen%'
  OR title ILIKE '%My Dress-Up Darling%' OR title ILIKE '%My dress up darling%'
  OR title ILIKE '%Roll Over and Die%'
  OR title ILIKE '%Sentenced to Be a Hero%'
  OR title ILIKE '%adventure%daily grind%29%' OR title ILIKE '%adventurer%daily grind%29%'
  OR title ILIKE '%greatest alchemist%'
  OR title ILIKE '%unique skill%OP%level 1%' OR title ILIKE '%unique skill%op%level 1%'
  OR title ILIKE '%cute girl%hero%party%confessing%'
  OR title ILIKE '%Hana-Kimi%' OR title ILIKE '%Hanakimi%'
  OR title ILIKE '%Mechanical Marie%'
  OR title ILIKE '%Reborn to Master the Blade%'
  OR title ILIKE '%our love make it through%' OR title ILIKE '%with you%love%through%'
  OR title ILIKE '%TSUKIMICHI%' OR title ILIKE '%Moonlit Fantasy%'
  OR title ILIKE '%Spy%Family%' OR title ILIKE '%Spy x Family%'
  OR title ILIKE '%daily life%immortal king%'
  OR title ILIKE '%gatherer%adventure%isekai%' OR title ILIKE '%gather%adventure%isekai%'
  OR title ILIKE '%nobody remember me%'
  OR title ILIKE '%wrong way%healing magic%'
  OR title ILIKE '%Bofuri%' OR title ILIKE '%max out my defense%'
  OR title ILIKE '%angel next door%spoils%';