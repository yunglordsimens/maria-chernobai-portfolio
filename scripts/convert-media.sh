#!/bin/bash
# ═══════════════════════════════════════════════════════
# convert-media.sh — Подготовка медиа для портфолио
# ═══════════════════════════════════════════════════════
#
# Использование:
#   ./scripts/convert-media.sh <input> <slug> [options]
#
# Примеры:
#   ./scripts/convert-media.sh video.mp4 leather-parfum --all
#   ./scripts/convert-media.sh video.mp4 leather-parfum --hero --thumb-video --thumb-gif
#   ./scripts/convert-media.sh photo.jpg leather-parfum --hero-img --thumb-img
#
# Опции:
#   --all           Всё из видео (hero + thumb video + thumb gif + sidebar + poster)
#   --hero          Hero video (1400px, полная длина, со звуком)
#   --hero-img      Hero image из фото (1400px WebP)
#   --thumb-video   Grid preview video (800px, 6 сек, без звука)
#   --thumb-gif     Grid preview GIF (400px, ускоренное, 12fps)
#   --thumb-img     Grid thumbnail из фото (800px WebP)
#   --sidebar       Extra-small animated (200px, ускоренное)
#   --sidebar-gif   Extra-small GIF (200px)
#   --poster        Static poster из первого кадра (800px WebP)
#   --gallery       Gallery image из фото (1400px WebP)
#
# Требования: ffmpeg, cwebp (brew install ffmpeg webp)
# ═══════════════════════════════════════════════════════

set -e

INPUT="$1"
SLUG="$2"
shift 2

if [ -z "$INPUT" ] || [ -z "$SLUG" ]; then
  echo "Usage: $0 <input-file> <project-slug> [options]"
  echo "  --all --hero --hero-img --thumb-video --thumb-gif --thumb-img"
  echo "  --sidebar --sidebar-gif --poster --gallery"
  exit 1
fi

OUT="public/media"
mkdir -p "$OUT"

# Определяем тип входного файла
EXT="${INPUT##*.}"
IS_VIDEO=false
if [[ "$EXT" =~ ^(mp4|mov|avi|mkv|webm)$ ]]; then
  IS_VIDEO=true
fi

do_hero() {
  echo "→ Hero video (1400px, full length, with audio)"
  ffmpeg -y -i "$INPUT" \
    -vf "scale=1400:-2" \
    -c:v libx264 -crf 23 -preset slow \
    -movflags +faststart \
    -c:a aac -b:a 128k \
    "$OUT/${SLUG}-hero.mp4"
  echo "  ✓ $OUT/${SLUG}-hero.mp4 ($(du -h "$OUT/${SLUG}-hero.mp4" | cut -f1))"
}

do_hero_img() {
  echo "→ Hero image (1400px WebP)"
  if $IS_VIDEO; then
    # Первый кадр из видео
    ffmpeg -y -i "$INPUT" -vframes 1 -vf "scale=1400:-2" "/tmp/${SLUG}-hero-tmp.png"
    cwebp -q 80 "/tmp/${SLUG}-hero-tmp.png" -o "$OUT/${SLUG}-hero.webp"
    rm "/tmp/${SLUG}-hero-tmp.png"
  else
    cwebp -q 80 -resize 1400 0 "$INPUT" -o "$OUT/${SLUG}-hero.webp"
  fi
  echo "  ✓ $OUT/${SLUG}-hero.webp ($(du -h "$OUT/${SLUG}-hero.webp" | cut -f1))"
}

do_thumb_video() {
  echo "→ Grid thumbnail video (800px, 6 sec, no audio, CRF 28)"
  ffmpeg -y -i "$INPUT" \
    -vf "scale=800:-2" \
    -t 6 -an \
    -c:v libx264 -crf 28 -preset veryslow \
    -movflags +faststart \
    "$OUT/${SLUG}-thumb.mp4"
  echo "  ✓ $OUT/${SLUG}-thumb.mp4 ($(du -h "$OUT/${SLUG}-thumb.mp4" | cut -f1))"
}

do_thumb_gif() {
  echo "→ Grid thumbnail GIF (400px, sped up 2x, 12fps, 4 sec)"
  # Генерируем палитру для лучшего качества GIF
  ffmpeg -y -i "$INPUT" \
    -vf "scale=400:-2,setpts=0.5*PTS,fps=12" \
    -t 4 \
    -filter_complex "[0:v] palettegen=max_colors=128 [p]" \
    "/tmp/${SLUG}-palette.png" 2>/dev/null || true

  ffmpeg -y -i "$INPUT" \
    -vf "scale=400:-2,setpts=0.5*PTS,fps=12,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" \
    -t 4 \
    -loop 0 \
    "$OUT/${SLUG}-thumb.gif"
  rm -f "/tmp/${SLUG}-palette.png"
  echo "  ✓ $OUT/${SLUG}-thumb.gif ($(du -h "$OUT/${SLUG}-thumb.gif" | cut -f1))"
}

do_thumb_img() {
  echo "→ Grid thumbnail image (800px WebP)"
  if $IS_VIDEO; then
    ffmpeg -y -i "$INPUT" -vframes 1 -vf "scale=800:-2" "/tmp/${SLUG}-thumb-tmp.png"
    cwebp -q 75 "/tmp/${SLUG}-thumb-tmp.png" -o "$OUT/${SLUG}-thumb.webp"
    rm "/tmp/${SLUG}-thumb-tmp.png"
  else
    cwebp -q 75 -resize 800 0 "$INPUT" -o "$OUT/${SLUG}-thumb.webp"
  fi
  echo "  ✓ $OUT/${SLUG}-thumb.webp ($(du -h "$OUT/${SLUG}-thumb.webp" | cut -f1))"
}

do_sidebar() {
  echo "→ Sidebar animated (200px MP4, sped up 2x, 3 sec)"
  ffmpeg -y -i "$INPUT" \
    -vf "scale=200:-2,setpts=0.5*PTS" \
    -t 3 -an \
    -c:v libx264 -crf 30 -preset veryslow \
    -movflags +faststart \
    "$OUT/${SLUG}-sidebar.mp4"
  echo "  ✓ $OUT/${SLUG}-sidebar.mp4 ($(du -h "$OUT/${SLUG}-sidebar.mp4" | cut -f1))"
}

do_sidebar_gif() {
  echo "→ Sidebar GIF (200px, sped up 2x, 10fps, 3 sec)"
  ffmpeg -y -i "$INPUT" \
    -vf "scale=200:-2,setpts=0.5*PTS,fps=10,split[s0][s1];[s0]palettegen=max_colors=64[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" \
    -t 3 \
    -loop 0 \
    "$OUT/${SLUG}-sidebar.gif"
  echo "  ✓ $OUT/${SLUG}-sidebar.gif ($(du -h "$OUT/${SLUG}-sidebar.gif" | cut -f1))"
}

do_poster() {
  echo "→ Poster (first frame, 800px WebP)"
  ffmpeg -y -i "$INPUT" -vframes 1 -vf "scale=800:-2" "/tmp/${SLUG}-poster-tmp.png"
  cwebp -q 75 "/tmp/${SLUG}-poster-tmp.png" -o "$OUT/${SLUG}-poster.webp"
  rm "/tmp/${SLUG}-poster-tmp.png"
  echo "  ✓ $OUT/${SLUG}-poster.webp ($(du -h "$OUT/${SLUG}-poster.webp" | cut -f1))"
}

do_gallery() {
  echo "→ Gallery image (1400px WebP)"
  cwebp -q 80 -resize 1400 0 "$INPUT" -o "$OUT/${SLUG}-gallery.webp"
  echo "  ✓ $OUT/${SLUG}-gallery.webp ($(du -h "$OUT/${SLUG}-gallery.webp" | cut -f1))"
}

# Парсим опции
if [ $# -eq 0 ]; then
  echo "No options specified. Use --all or pick specific outputs."
  echo "Run with no arguments for help."
  exit 1
fi

for opt in "$@"; do
  case "$opt" in
    --all)
      if $IS_VIDEO; then
        do_hero; do_thumb_video; do_thumb_gif; do_sidebar; do_sidebar_gif; do_poster
      else
        do_hero_img; do_thumb_img
      fi
      ;;
    --hero)        do_hero ;;
    --hero-img)    do_hero_img ;;
    --thumb-video) do_thumb_video ;;
    --thumb-gif)   do_thumb_gif ;;
    --thumb-img)   do_thumb_img ;;
    --sidebar)     do_sidebar ;;
    --sidebar-gif) do_sidebar_gif ;;
    --poster)      do_poster ;;
    --gallery)     do_gallery ;;
    *) echo "Unknown option: $opt" ;;
  esac
done

echo ""
echo "Done! Files in $OUT/"
ls -lh "$OUT/${SLUG}"* 2>/dev/null || true
