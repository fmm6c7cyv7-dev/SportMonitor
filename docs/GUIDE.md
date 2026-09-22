# 📘 Utvecklingsguide för SportMonitor

Denna guide hjälper dig att hålla ordning på projektet och undvika framtida kaos.

## 🌳 Branch-struktur
- **`main`**: Produktionsklar kod. Det som syns på den publika URL:en.
- **`dev`**: Här sker allt arbete. Pusha hit för att testa nya funktioner.
- **`stable-archive-v1`**: En tidskapsel av den gamla strukturen (innan flytten till roten). Rör ej!

## 🚦 Arbetsflöde
När du ska bygga något nytt:
1. Se till att du är på `dev`: `git checkout dev`
2. Bygg och testa lokalt.
3. Commita: `git add .` -> `git commit -m "feat: beskrivning"`
4. Pusha: `git push origin dev`
5. När allt fungerar perfekt, merga till main:
   - `git checkout main`
   - `git merge dev`
   - `git push origin main`

## 🧹 Städning i Databasen (Supabase)
Om du får in oönskat innehåll, kör detta i SQL Editor:
```sql
DELETE FROM news_items 
WHERE title ILIKE ANY (ARRAY['%skidor%', '%skid-vm%', '%alpint%', '%sdhl%']);