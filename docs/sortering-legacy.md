# Sortering (legacy) interaksjonsnotater

## Tilgjengelighet
- Dual-lags-rendering: hvert `SortableItem` oppretter et SVG-element (`svgEl`) og et parallelt DOM-element (`skia`/`button`) for skjermleservennlig interaksjon. Se konstruktøren i `SortableItem` for opprettelsen av `svgEl`, `skia` og `button`, samt `Sorting.skia` som inneholder den semantiske `<ol>`-representasjonen. Relaterte metoder: `Sorting.initialize` og `SortableItem.placeBefore` for synkronisering av lagene.
- Fokusstyring: `registerListeners` legger til focus/blur-lyttarar på `button` for å sette klassen `focus` og spore `current`. `handleEscape` nullstiller tilstand og fjerner tastelyttarar fra alle element.
- Mål-tilstand: `button`-klikk aktiverer `EikonesItem` via `eikones.activate()` og gjør andre element til mål (`eikones.makeTarget()`), og `handleEscape` fjerner målstatus.

## Tastaturnavigasjon
- `registerListeners` knytter en `keydown`-lytter (`keyHandler`) til dokumentet når et element er aktivt, slik at piltaster bytter elementposisjon via `swapWith`. Enter tvinger `handleEscape` for å avslutte målmodus. Escape på dokumentnivå avbryter moduset for alle elementer.
- Piltastenes retning mapes i `keyHandler` til `swapWith(-1|1, true, true)` for å flytte elementet ett trinn og samtidig snappe både seg selv og naboelementet tilbake til rasteret.

## Drag-oppførsel
- `registerListeners` initialiserer `svgEl.draggable()` og `eikones.draggable()`. `beforedrag` blokkerer parallell draing ved hjelp av den globale telleren `window.dragCount`.
- Under `dragstart` aktiveres elementet (`eikones.activate()`) og en `dragmove`-lytter registreres via `produceSwapEventHandler`, som dynamisk beregner bytteboksen basert på `calculateSwapBox`.
- `dragend` deaktiverer elementet, kaller `snapInPlace` for å animere tilbake til rasteret og `vessel.emitOutputs()` for å oppdatere tilstandsstrømmer.

## Statusberegning
- `produceSwapEventHandler` kontrollerer posisjonen til elementets sentrum mot en utvidet kollisjonsboks og kaller `move(Direction.*)` for å trigge `swapWith` når et element krysser terskelen.
- `swapWith` bytter elementer i `Sorting.items`, holder begge lag synkronisert gjennom `swapItems` (DOM) og valgfri snapping (`snapInPlace`).
- `Sorting.emitOutputs` evaluerer datastrømmer (`sorted`, `firstN`, `lastN`, `almost`, `order`) basert på nåværende rekkefølge, ved hjelp av hjelpefunksjonene `firstN`, `lastN`, `sortedPairs` og `almost`.
- `snapInPlace` bruker `calculateSnapCenter` og `svg.js`-animasjon for å sikre visuell alignering etter tastatur- eller draoperasjoner.

## Relaterte API-er
- `registerListeners`, `produceSwapEventHandler`, `swapWith`, `snapInPlace`, `calculateSwapBox`, `calculateSnapCenter`, `Sorting.emitOutputs`, `Sorting.initialize` i `old_projects/skafos/sorting.component.ts`.
