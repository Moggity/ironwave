# Translating IRONWAVE

Each language is one plain file in this folder. `en.js` is the source of
truth. To add a language:

1. Copy `en.js` to `<code>.js`, where `<code>` is the two-letter language
   code (`es.js` for Spanish, `de.js` for German, ...).
2. In your copy, change the two `EN` markers: rename the `I18N_EN` constant
   (both at the top and in the last line) to match your code, and set the
   last line's language name to the language's own name, e.g.
   `I18N.register('de', 'Deutsch', I18N_DE);`.
3. Translate the VALUES only (the text right of each `:`). Never change the
   keys (the `'quoted.names'` left of each `:`).
4. Keep placeholders like `{name}`, `{week}` or `{n}` exactly as they are;
   the app fills them in at runtime. You can move them around in the
   sentence.
5. Keep any HTML tags like `<b>...</b>` around the equivalent words.
6. Style: keep strings short and imperative, and do not use em dashes
   (this is a hard app-wide rule for athlete-facing text).
7. Send the file back, or open a pull request that also adds the file to
   the `<script>` list in `index.html` and to `SHELL` in `sw.js` so the
   language works offline.

A missing key is fine: the app falls back to English for it. An extra or
misspelled key fails the test suite, which is your typo net.

## Regional note: Spanish

`es.js` is written in **Latin American Spanish** (agregar not añadir,
pantorrillas not gemelos, femorales not isquios, tirón not jalón,
culturismo not fisicoculturismo, al 100 not a tope, la configuración not
los ajustes). Gym terms that are conventionally said in English stay in
English: pump (not bombeo), drop set (not serie descendente), rest-pause
(not descanso-pausa), myo-reps, AMRAP, RIR. When in doubt, prefer the
English loanword the gym floor actually uses. Keep new keys in that
register. If a Spain-Spanish variant is ever wanted, copy `es.js` to a new
catalog and re-localize; the pre-Latam wording also survives in git history
(branch `claude/english-spanish-translation-cajw1r`, commit `85943f0`).
