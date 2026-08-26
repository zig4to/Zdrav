# Zdrav

Baza zdravih obrokov (zajtrk, kosilo, večerja, malica) s sliko, imenom in sestavinami.
Ko zmanjka idej, gumb **🎲 Presenečenje** naključno izbere obrok iz izbrane kategorije.

Brez strežnika — vsi obroki (vključno s slikami) so shranjeni lokalno v brskalniku
(IndexedDB), zato baza ostane majhna in deluje brez interneta.

## Zagon

```bash
npm start
```

Odpre statični strežnik na `:8080`. Ni build koraka, ni odvisnosti.

## Struktura

| Datoteka             | Vsebina                                          |
|-----------------------|---------------------------------------------------|
| `index.html`          | Naslov, zavihki kategorij, mreža obrokov, modali  |
| `style.css`           | Temna, zelena "zdrava" tema                       |
| `js/db.js`            | IndexedDB shramba (`window.DB`) — obroki + slike  |
| `js/app.js`           | Zavihki, dodajanje obrokov, naključni izbor        |
| `manifest.json`       | Podatki za namestitev (ime, ikone, barve)         |
| `sw.js`               | Service worker — namestljivost in delo brez neta  |
| `icon.svg`            | Izvorna risba ikone (list)                        |
| `icons/`              | Generirane PNG ikone                              |
| `tools/make-icons.js` | Generator ikon (`npm run icons`)                  |
| `serve.js`            | Mini dev strežnik brez odvisnosti                 |

Slika ob dodajanju obroka se pomanjša na največ 900 px širine in shrani kot JPEG
(kakovost 0.85) — glej `downscaleImage` v `js/app.js`.

## Namestitev na telefon

PWA. Na **Androidu (Chrome)**: meni ⋮ → *Namesti aplikacijo*. Na **iPhonu (Safari)**:
Deli → *Dodaj na začetni zaslon*. Pogoj je HTTPS — deluje na GitHub Pages.

> Po vsaki spremembi datotek povečaj `VERSION` v `sw.js`, sicer nameščene naprave
> še nekaj časa vidijo staro različico iz predpomnilnika.

## Objava na GitHub Pages

```bash
git remote add origin https://github.com/zig4to/Zdrav.git
git push -u origin main
```

Nato v nastavitvah repota: **Settings → Pages → Deploy from branch → main / root**.
