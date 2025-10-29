# Sortering (legacy)

Denne siden dokumenterer den eldre Angular-komponenten `Sorting` fra `old_projects/skafos`. Dokumentasjonen er basert på kildekoden i `sorting.component.ts` og beskriver hvordan konfigurasjonen fortolkes, hvordan elementene plasseres og hvilke utdata som publiseres.

## Flytoversikt

```mermaid
graph TD
    A[initialize(config)] --> B[randomOrder]
    A --> C[getGap]
    A --> D[SortableItem]
    D --> E[placeItemsInOrder]
    E --> F[snapInPlace]
    F --> G[emitOutputs]
    G --> H[firstN/lastN/almost/isSorted]
```

Figuren viser at `initialize` normaliserer konfigurasjonen (bl.a. via `getGap`), oppretter `SortableItem`-instanser og deretter delegere rekkefølgen til `placeItemsInOrder`. Når brukeren manipulerer elementene, kalles `emitOutputs`, som igjen bruker hjelpefunksjonene for å beregne tilstandssignaler.【F:old_projects/skafos/sorting.component.ts†L301-L386】【F:old_projects/skafos/sorting.component.ts†L387-L470】

## Konfigurasjonsfelter

| Felt | Type / mulige verdier | Standard | Beskrivelse |
| --- | --- | --- | --- |
| `direction` | `'horizontal' \| 'vertical' \| true \| 'true' \| false \| 'false'` | Tolkning: `true`/`'true'` → `'horizontal'`, `false`/`'false'` → `'vertical'` | Styrer om oppgaven gjengis horisontalt eller vertikalt. `initialize` normaliserer gamle boolske verdier slik at resten av koden kan bruke strengene konsekvent.【F:old_projects/skafos/sorting.interface.ts†L5-L10】【F:old_projects/skafos/sorting.component.ts†L317-L327】 |
| `randomized` | `boolean` (valgfri) | `true` | Angir om startrekkefølgen skal stokkes. Hvis feltet mangler, stokkes elementene slik at de ikke starter sortert.【F:old_projects/skafos/sorting.component.ts†L327-L341】 |
| `gap` | `number` (valgfri) | `10` | Avstand mellom elementrammer. `getGap` gir reserveverdien og brukes både ved initiering og ved opprettelse av hvert element.【F:old_projects/skafos/sorting.component.ts†L317-L359】【F:old_projects/skafos/sorting.component.ts†L343-L350】 |
| `items` | `Record<string, SortableItemInterface>` | – | Oppslagsobjekt der nøkkelen er element-ID. Hvert objekt må inkludere `value` (tall) i tillegg til feltene som `EikonesService` trenger (f.eks. `type`, tekst/LaTeX/figurdata). `initialize` gjør oppslagene, oppretter `SortableItem`-instanser og kobler hver ID til riktig grafikkflate.【F:old_projects/skafos/sorting.interface.ts†L5-L13】【F:old_projects/skafos/sorting.component.ts†L343-L353】 |
| `order` | `string[]` | – | Forventet rekkefølge for element-ID-er. Brukes som fasit ved reset, og som utgangspunkt for `randomOrder` hvis stokking er aktivert.【F:old_projects/skafos/sorting.component.ts†L338-L345】【F:old_projects/skafos/sorting.component.ts†L301-L309】 |
| `value` | `number` (per `item`) | – | Tall som brukes til å vurdere sorteringsgrad i `emitOutputs`. Elementenes `value` leses i samme rekkefølge som de vises og sammenlignes med den sorterte varianten.【F:old_projects/skafos/sorting.component.ts†L407-L434】 |

## Rekkefølgehåndtering

1. `initialize` normaliserer `direction`, vurderer om elementene skal stokkes, og bygger så en liste av `SortableItem`-instanser med riktig bredde/høyde basert på valgt orientering.【F:old_projects/skafos/sorting.component.ts†L312-L355】
2. `randomOrder` stokker `order`-listen inntil verdiene ikke allerede er sortert (slik at oppgaven krever handling).【F:old_projects/skafos/sorting.component.ts†L301-L309】
3. `placeItemsInOrder` flytter hvert element til riktig posisjon ved å sammenligne den ønskede ID-rekkefølgen med dagens indeks og bruke `swapWith`. Dette brukes både ved initiering og når brukeren trykker «reset».【F:old_projects/skafos/sorting.component.ts†L362-L370】

`SortableItem.snapInPlace` sørger for animert plassering når et element slippes eller flyttes programmatisk.【F:old_projects/skafos/sorting.component.ts†L264-L266】

## Utdata og hjelpefunksjoner

| Kanal | Type | Beregning | Tolkning |
| --- | --- | --- | --- |
| `sorted` | `boolean` | `isSorted(values)` returnerer `true` når alle elementverdier allerede er i ikke-synkende rekkefølge. | Signaliserer at oppgaven er helt løst.【F:old_projects/skafos/sorting.component.ts†L401-L432】 |
| `firstN` | `number` | `firstN(values)` teller hvor mange verdier fra venstre som er på riktig plass sammenlignet med sortert liste. | Antall korrekte elementer fra startposisjonen.【F:old_projects/skafos/sorting.component.ts†L401-L420】 |
| `lastN` | `number` | `lastN(values)` teller hvor mange verdier fra høyre som er korrekte. | Antall korrekte elementer fra slutten.【F:old_projects/skafos/sorting.component.ts†L401-L420】 |
| `almost` | `boolean` | `almost(values)` sammenligner antall sorterte par mot maksimum og aksepterer én feil for ≤5 elementer eller to feil ellers. | Viser om løsningen er «nesten sortert» og kan brukes til hint eller partiell kreditering.【F:old_projects/skafos/sorting.component.ts†L421-L434】 |
| `order` | `number[]` | Kopi av `values` i dagens visningsrekkefølge. | Gir direkte tilgang til gjeldende tallsekvens, f.eks. for logging eller videre behandling.【F:old_projects/skafos/sorting.component.ts†L401-L406】 |

Hjelpefunksjonene `sortedPairs`, `firstN`, `lastN` og `almost` er rent deterministiske og avhenger kun av verdiene i `items`. De gjør ingen endringer i komponenttilstanden og kan derfor dokumenteres eller testes isolert.【F:old_projects/skafos/sorting.component.ts†L407-L434】

## JSON-kontrakt for nye oppgaver

Følgende struktur anbefales for å definere nye sorteringsoppgaver. Den bygger på `SortingConfig` og viser hvordan tekst-, KaTeX- og figurelementer kan kombineres.

```json
{
  "direction": "horizontal",
  "randomized": false,
  "gap": 12,
  "order": ["latex_a", "text_b", "figure_c"],
  "items": {
    "latex_a": {
      "type": "Latex",
      "value": 1,
      "latex": "x^2 - 1",
      "ariaLabel": "x i andre minus én"
    },
    "text_b": {
      "type": "Text",
      "value": 2,
      "text": "Sorter meg som nummer to",
      "ariaLabel": "Tekst nummer to"
    },
    "figure_c": {
      "type": "Code",
      "value": 3,
      "code": "<svg viewBox=\"0 0 10 10\"><circle cx=\"5\" cy=\"5\" r=\"4\" /></svg>",
      "ariaLabel": "Sirkelillustrasjon"
    }
  }
}
```

### Feltforklaring for eksemplet

- `type` må samsvare med `ItemType`-enumet (`Latex`, `Text`, `Code`) slik at `EikonesService` kan gjengi korrekt media i både SVG og skjermleser-listen.【F:old_projects/skafos/sorting.component.ts†L62-L90】
- `value` styrer sorteringslogikken og bør være et heltall eller flyttall som reflekterer riktig fasitposisjon.【F:old_projects/skafos/sorting.component.ts†L401-L434】
- `ariaLabel` er anbefalt for tilgjengelighet selv om koden ikke håndhever det direkte.
- `randomized` satt til `false` i eksemplet gir forutsigbar startrekkefølge for demonstrasjon; sett det til `true` for oppgaver som skal stokkes automatisk.【F:old_projects/skafos/sorting.component.ts†L327-L341】

Ved å følge denne kontrakten kan nye oppgaver lages konsekvent, samtidig som de gamle hjelpefunksjonene fortsatt leverer meningsfulle utdata-kanaler.
