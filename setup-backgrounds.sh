#!/bin/bash
# setup-backgrounds.sh
# Scarica gli sfondi virtuali fotografici (Unsplash) in public/assets/backgrounds
# (uffici, case, Italia, natura, spazio, astratti, videogiochi),
# con le miniature in public/assets/backgrounds/thumbs (il pannello carica quelle,
# la foto intera solo quando la scegli).
#
# Foto: Unsplash (https://unsplash.com/license) — uso libero, anche commerciale,
# senza obbligo di attribuzione. Non sono nel repository: le scarica questo script.
#
# Uso:
#   chmod +x setup-backgrounds.sh
#   ./setup-backgrounds.sh            # scarica solo quelle che mancano
#   ./setup-backgrounds.sh --force    # riscarica tutto
#
# Il numero davanti al nome decide l'ordine nel pannello e non si vede;
# il resto del nome diventa l'etichetta ("03-sala-riunioni" → "Sala riunioni").
# La cartella è montata nel container: niente riavvio, basta riaprire il pannello.

set -e

DEST="public/assets/backgrounds"
THUMBS="$DEST/thumbs"
BASE="https://images.unsplash.com/photo-"
FORCE=0
[ "$1" = "--force" ] && FORCE=1

mkdir -p "$DEST" "$THUMBS"

# nome-file  id-unsplash
LIST=(
  "01-open-space-vetrato        1497366811353-6870744d04b2"
  "02-sala-riunioni             1517502884422-41eaead166d4"
  "03-scrivania-con-vista       1497215728101-856f4ea42174"
  "04-lounge-luminosa           1524758631624-e2822e304c36"
  "05-soggiorno-scandinavo      1493809842364-78817add7ffb"
  "06-angolo-con-piante         1502672260266-1c1ef2d93688"
  "07-salotto-elegante          1505691938895-1758d7feb511"
  "08-divano-in-pelle           1554995207-c18c203602cb"
  "09-poltrona-gialla           1586023492125-27b2c045efd7"
  "10-stanza-minimal            1513694203232-719a280e022f"
  "11-salotto-con-quadri        1600210492486-724fe5c67fb0"
  "12-living-moderno            1600607687939-ce8a6c25118c"
  "13-biblioteca                1507842217343-583bb7270b66"
  "14-biblioteca-circolare      1524995997946-a1c2e315a42f"
  "15-Cinque-Terre              1516483638261-f4dbaf036963"
  "16-Venezia                   1523906834658-6e24ef2386f9"
  "17-Colosseo                  1552832230-c0197dd311b5"
  "18-lago-alpino               1501785888041-af3ef285b470"
  "19-spiaggia-al-tramonto      1507525428034-b723cf961d3e"
  "20-bosco                     1441974231531-c6227db76b6e"
  "21-montagne-sopra-le-nuvole  1506905925346-21bda4d32df4"
  "22-colline-nella-nebbia      1470071459604-3b5ec3a7fe05"
  "23-valle-al-mattino          1506744038136-46273834b3fb"
  "24-Santorini                 1533105079780-92b9be482077"
  "25-Monte-Fuji-in-fiore       1490806843957-31f4c9a91c65"
  "26-Via-Lattea                1519681393784-d120267933ba"
  "27-grattacieli               1477959858617-67f85cf4f1df"
  "30-nebulosa                  1462331940025-496dfbfc7564"
  "31-Terra-dallo-spazio        1446776811953-b23d57bd21aa"
  "32-Terra-di-notte            1451187580459-43490279c0fa"
  "33-astronauta                1454789548928-9efd52dc4031"
  "34-galassia-di-Andromeda     1543722530-d2c3201371e7"
  "35-centro-della-galassia     1502134249126-9f3755a50d78"
  "36-Saturno                   1614732414444-096e5f1122d5"
  "37-cielo-stellato            1419242902214-272b3f66ee7a"
  "40-onde-colorate             1618005182384-a83a8bd57fbe"
  "41-sfumatura-arcobaleno      1579546929518-9e396f3cc809"
  "42-spirale-viola             1617791160505-6f00504e3519"
  "43-spirale-turchese          1618172193622-ae2d025f4032"
  "44-onde-blu                  1620121692029-d088224ddc74"
  "45-onda-notturna             1620641788421-7a1c342ea42e"
  "46-sfumatura-neon            1614850523459-c2f4c699c52e"
  "47-seta-colorata             1604076913837-52ab5629fba9"
  "48-marmo-pastello            1557672172-298e090bd0f1"
  "49-inchiostro-colorato       1541701494587-cb58502866ab"
  "50-linee-bianche             1558591710-4b4a1ae0f04d"
  "51-cosmo-astratto            1563089145-599997674d42"
  "52-grana-viola               1635776062127-d379bfcba9f8"
  "63-game-over                 1579373903781-fd5c0c30c4cd"
  "64-sala-giochi               1511512578047-dfb367046420"
  "65-tastiera-RGB              1538481199705-c710c4e965fc"
  "66-angolo-vintage            1550745165-9bc0b252726f"
  "67-controller                1552820728-8b83bb6b773f"
  "68-controller-su-giallo      1580327344181-c1163234e5a0"
  "69-controller-neon           1612287230202-1ff1d85d1bdf"
  "70-circuito                  1515630278258-407f66498911"
)

ok=0; skip=0; fail=0
for row in "${LIST[@]}"; do
  name=$(echo "$row" | awk '{print $1}')
  id=$(echo "$row" | awk '{print $2}')
  img="$DEST/$name.jpg"; th="$THUMBS/$name.jpg"
  if [ $FORCE -eq 0 ] && [ -s "$img" ] && [ -s "$th" ]; then skip=$((skip+1)); continue; fi
  if curl -fsSL -m 60 -o "$img.part" "${BASE}${id}?w=1920&h=1080&fit=crop&q=80&fm=jpg" \
     && curl -fsSL -m 30 -o "$th.part" "${BASE}${id}?w=384&h=216&fit=crop&q=70&fm=jpg"; then
    mv "$img.part" "$img"; mv "$th.part" "$th"
    echo "  ✓ $name"; ok=$((ok+1))
  else
    rm -f "$img.part" "$th.part"
    echo "  ✗ $name (non scaricata)"; fail=$((fail+1))
  fi
done

echo "→ Sfondi: $ok scaricati, $skip già presenti, $fail non riusciti"
[ $fail -eq 0 ] || exit 1
