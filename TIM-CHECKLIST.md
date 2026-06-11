# TIM-CHECKLIST.md — Jouw stappen

## Vandaag (voor de bouw start)

1. **API key**: account op football-data.org (gratis tier), key kopiëren. ~2 min.
2. **Database**: in je Vercel dashboard → Storage/Marketplace → Neon Postgres aanmaken (gratis tier). DATABASE_URL kopiëren.
3. **Repo**: nieuwe repo (bijv. `wk-poule-2026`), deze vijf .md-bestanden in de root zetten, map `/branding` aanmaken met:
   - `logo.svg` of `logo.png` van Hotel van Saaze
   - `brand.md` met de officiële hexcodes en fontnamen (jij levert specs, Claude Code gokt niet)
4. **.env** lokaal: `DATABASE_URL=`, `FOOTBALL_DATA_API_KEY=`, `ADMIN_PASSWORD=` (kies zelf iets sterks). Dezelfde drie als environment variables in het Vercel-project zetten.
5. Claude Code starten in de repo en Fase 1 uit FASEN.md plakken.

## Tijdens de bouw (11–14 juni, prioriteit fases 1–5)

6. Na Fase 1: check zelf in de output dat Poule F = Nederland, Japan, Zweden, Tunesië en dat de R32-allocatietabel door beide bronnen bevestigd is. Bij twijfel: stoppen, niet gokken.
7. Na Fase 5: test met 1–2 vrienden op hun telefoon vóór je de link breed deelt. Test expliciet: bijnaam claimen, verkeerde pincode, voorspelling aanpassen.
8. Link delen in de groepsapp. Deadline communiceren: **zondag 14 juni 22:00**.

## Beslissing voor vandaag

- **Eerdere lock?** Het toernooi is vandaag begonnen; wie op 13 juni invult kent al uitslagen uit poules A/B/D. Iedereen heeft dezelfde info en de overige poules tellen alleen de eindstand, dus de schade is beperkt — maar als je het strakker wilt: zet group_lock_utc op vanavond en deel de link nu. Default in de spec blijft 14 juni 22:00.

## Rond 27–28 juni

9. Als alle 72 groepswedstrijden klaar zijn: in /beheer `knockout_open` aanzetten en `knockout_lock_utc` op de aftrap van de eerste zestiende finale zetten. Aankondigen in de groepsapp — het venster is kort (±1 dag), dat is bewust.
10. Fases 6–7 moeten vóór dit moment live zijn; plan de Claude Code-sessies daarop.

## Doorlopend

11. /beheer in de gaten houden bij rare API-data; handmatige correctie wint altijd van de API.
12. Bij een API-storing tijdens een wedstrijd: score handmatig invoeren, klaar.

## Wat ik (Claude, deze chat) nog voor je kan doen

- Reviewen van Claude Code's r32_allocation-tabel als je de output hier plakt.
- De aankondigingstekst voor de groepsapp schrijven (in jouw stijl, geen AI-woorden).
- Meedenken als Fase 1 uitwijst dat football-data.org WC2026 niet gratis levert.
