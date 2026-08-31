# Zdrav

Baza zdravih obrokov (zajtrk, kosilo, večerja, malica) s sliko, imenom in sestavinami.
Ko zmanjka idej, gumb **🎲 Presenečenje** naključno izbere obrok iz izbrane kategorije.

Vsak uporabnik se prijavi (Supabase Auth, e-pošta + geslo) in ima **svoje** obroke.
Obroki in slike so shranjeni v Supabase (Postgres + Storage). Brez povezave aplikacija
prikaže zadnje znane obroke iz lokalnega predpomnilnika (IndexedDB); dodajanje in
urejanje potrebujeta internet.

## Nastavitev Supabase

1. Ustvari projekt na [supabase.com](https://supabase.com).
2. **SQL Editor → New query** → prilepi in poženi `supabase/schema.sql`
   (ustvari tabelo `jedi`, bucket `jedi-slike` in RLS pravila; varno za večkratni zagon).
3. **Authentication → Providers → Email**: omogoči. Za hitro testiranje lahko izklopiš
   "Confirm email" (sicer je pred prvo prijavo treba potrditi e-pošto).
4. **Authentication → URL Configuration → Redirect URLs**: dodaj naslove, kamor sme
   voditi povezava za ponastavitev gesla, npr. `http://localhost:8137/**` in
   `https://<uporabnik>.github.io/Zdrav/**`. Brez tega gumb "Pozabljeno geslo?"
   ne bo deloval (povezava pristane na Site URL).
5. **Project Settings → API** → prekopiraj *Project URL* in *anon public* ključ v
   `js/config.js`.

`anon` ključ je javen po zasnovi — varujejo ga RLS pravila iz sheme.

## Zagon

```bash
npm start
```

Odpre statični strežnik na `:8137` (nastavljeno v `package.json` → `config.port`;
lahko povoziš z `PORT`). Ni build koraka, ni odvisnosti (Supabase JS se naloži prek CDN).

## Ponastavitev gesla

Na prijavnem zaslonu **Pozabljeno geslo?** pošlje e-pošto s povezavo. Klik na povezavo
odpre Zdrav z zaslonom za novo geslo (`js/auth.js` ujame dogodek `PASSWORD_RECOVERY`).
Veljavna je le najnovejša povezava in le nekaj časa — če je potekla, aplikacija to
pove in ponudi novo pošiljanje.

## Struktura

| Datoteka               | Vsebina                                                    |
|------------------------|-----------------------------------------------------------|
| `index.html`           | Prijavni zaslon, zavihki kategorij, mreža obrokov, modali |
| `style.css`            | Temna in svetla zelena "zdrava" tema (spremenljivke)      |
| `js/theme.js`          | Preklop svetlo/temno (gumb zgoraj desno, shrani izbiro)   |
| `js/config.js`         | Supabase URL + anon ključ (izpolniš sam)                  |
| `js/db.js`             | Supabase klient (`window.sb`) + operacije nad jedmi (`window.DB`) z IndexedDB bralnim predpomnilnikom |
| `js/auth.js`           | Prijava / registracija / odjava / ponastavitev gesla      |
| `js/app.js`            | Zavihki, dodajanje in urejanje obrokov, naključni izbor    |
| `supabase/schema.sql`  | Tabela `jedi`, Storage bucket, RLS pravila                |
| `manifest.json`        | Podatki za namestitev (ime, ikone, barve)                 |
| `sw.js`                | Service worker — namestljivost in delo brez neta          |
| `icon.svg`             | Izvorna risba ikone (list)                                |
| `icons/`               | Generirane PNG ikone                                      |
| `tools/make-icons.js`  | Generator ikon (`npm run icons`)                          |
| `serve.js`             | Mini dev strežnik brez odvisnosti                         |

Slika ob dodajanju obroka se pomanjša na največ 900 px širine in shrani kot JPEG
(kakovost 0.85) — glej `downscaleImage` v `js/app.js` — nato se naloži v Supabase
Storage bucket `jedi-slike` v mapo `<user_id>/<jed_id>.jpg`.

## Namestitev na telefon

PWA. Na **Androidu (Chrome)**: meni ⋮ → *Namesti aplikacijo*. Na **iPhonu (Safari)**:
Deli → *Dodaj na začetni zaslon*. Pogoj je HTTPS — deluje na GitHub Pages.

> Po vsaki spremembi datotek povečaj `VERSION` v `sw.js` (trenutno `zdrav-v12`), sicer
> nameščene naprave še nekaj časa vidijo staro različico iz predpomnilnika.

## Objava na GitHub Pages

```bash
git remote add origin https://github.com/zig4to/Zdrav.git
git push -u origin main
```

Nato v nastavitvah repota: **Settings → Pages → Deploy from branch → main / root**.
V Supabase pod **Authentication → URL Configuration** dodaj naslov GitHub Pages med
*Redirect URLs* (za potrditev e-pošte).
