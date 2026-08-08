# Unifilari ATS

Applicazione web statica per creare schemi unifilari di distribuzione elettrica per eventi.

Funziona interamente nel browser e non invia dati a servizi esterni. Include libreria quadri, controllo delle compatibilità, gestione delle prese, import Capture, Socapex, riferimenti multipagina, autosalvataggio ed esportazione PDF.

## Avvio

È possibile aprire direttamente `index.html` con un browser moderno.

Per lo sviluppo è consigliato un server locale:

```bash
python3 -m http.server 4173
```

Aprire quindi `http://127.0.0.1:4173`.

Non sono richieste dipendenze JavaScript. Node.js è necessario soltanto per eseguire i test.

## Flusso consigliato

1. Compilare nome evento, luogo, tipologia e versione.
2. Creare una fornitura.
3. Aggiungere un quadro dalla libreria o configurare un quadro temporaneo.
4. Collegare la fornitura al quadro. L’app mostra solamente destinazioni e cavi compatibili.
5. Aggiungere o importare le utenze.
6. Collegare le utenze singolarmente, in blocco oppure tramite Socapex.
7. Organizzare il layout e creare eventuali pagine aggiuntive.
8. Salvare il progetto JSON ed esportare il PDF.

L’app impedisce auto-collegamenti, direzioni non ammesse, cicli, cavi incompatibili, ingressi doppi, prese occupate e superamento della capacità dei quadri.

## Import Capture

Il file deve contenere le colonne:

```text
Fixture;Wattage;Circuit
```

Sono riconosciuti automaticamente i delimitatori virgola, punto e virgola e tabulazione. I nomi delle colonne non distinguono maiuscole e minuscole.

I valori `Wattage` possono usare formati italiani o internazionali, ad esempio `650,5`, `1200.5` oppure `1.200,5`.

Le fixture vengono raggruppate per `Circuit` e i relativi assorbimenti vengono sommati. Un file di esempio è disponibile in [`examples/capture-esempio.csv`](examples/capture-esempio.csv).

## Salvataggio e recupero

- **Salva progetto** esporta esclusivamente i dati del progetto in formato JSON versione 6.
- Le modifiche vengono salvate automaticamente anche nel browser.
- All’avvio viene proposto il recupero dell’ultimo autosalvataggio disponibile.
- Aprire un altro progetto non elimina immediatamente l’autosalvataggio corrente.
- Undo e redo sono disponibili dalla barra superiore.

Scorciatoie:

- `Cmd/Ctrl + Z`: annulla;
- `Cmd/Ctrl + Maiusc + Z` oppure `Cmd/Ctrl + Y`: ripristina;
- `Canc`/`Backspace`: elimina la selezione;
- `Maiusc` o `Cmd/Ctrl + clic`: selezione multipla.

## Pagine e layout

La pagina corrente si seleziona dalla barra sopra il disegno. Le pagine possono essere aggiunte o eliminate.

Una pagina contiene al massimo 18 utenze disposte automaticamente senza sovrapposizioni. Se un’aggiunta o un’importazione supera questo limite, vengono create nuove pagine. Quando necessario, il quadro di origine viene richiamato automaticamente sulla nuova pagina mantenendo condivisa la disponibilità fisica delle prese.

Su tablet il pannello Proprietà è disponibile come drawer laterale. Su mobile anche la barra degli strumenti diventa richiudibile e l’area del disegno può scorrere orizzontalmente.

## Progetti precedenti

I progetti creati dalle versioni precedenti vengono migrati automaticamente:

- conversione del vecchio nodo Socapex;
- generazione delle chiavi fisiche per forniture e quadri richiamati;
- conversione dei vecchi PowerLock;
- normalizzazione e rinumerazione delle pagine.

File corrotti, collegamenti orfani e valori non validi vengono rifiutati con un messaggio senza sostituire il progetto aperto.

## Test

```bash
npm test
npm run check
```

`npm run check` verifica la sintassi di `core.js` e `app.js`, quindi esegue i test del dominio elettrico e dello schema progetto.

## Struttura

- `core.js`: schema, normalizzazione, compatibilità, prese e validazione della topologia;
- `app.js`: stato, interfaccia, rendering SVG, importazione, layout e stampa;
- `index.html`: struttura dell’interfaccia;
- `styles.css`: layout a schermo, responsive e stampa;
- `tests/`: test automatici del dominio;
- `examples/`: file di importazione di esempio.

## Pubblicazione

Il progetto è composto soltanto da file statici e può essere pubblicato direttamente con GitHub Pages. Prima della pubblicazione eseguire:

```bash
npm run check
```

## Licenza

GNU GPL v3.
