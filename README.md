# Unifilari

Applicazione web statica per creare schemi unifilari di distribuzione elettrica per eventi.

Progetti, calcoli, importazioni ed esportazioni vengono gestiti nel browser. La ricerca facoltativa degli indirizzi invia il testo cercato al servizio Photon; tutti i campi possono essere compilati anche senza connessione. Include libreria quadri, controllo delle compatibilità, gestione delle prese, import Capture, Socapex, riferimenti multipagina, autosalvataggio ed esportazione PDF.

## Avvio

È possibile aprire direttamente `index.html` con un browser moderno.

Per lo sviluppo è consigliato un server locale:

```bash
python3 -m http.server 4173
```

Aprire quindi `http://127.0.0.1:4173`.

L’app non richiede dipendenze JavaScript da installare o un processo di compilazione. Node.js 20 o successivo serve soltanto per lo sviluppo e i test; Python 3 serve per il server locale.

## Browser

L’interfaccia usa API standard condivise da Safari, Firefox e Chrome moderni. Il foglio conserva uno stile di riserva quando le unità relative al contenitore o l’altezza dinamica della finestra non sono disponibili. La creazione degli identificativi funziona anche senza `crypto.randomUUID`, per esempio su una rete locale HTTP.

I test automatici coprono Firefox e WebKit, il motore di Safari, su desktop e con finestre da 320, 390, 768 e 1024 pixel. WebKit automatizzato non sostituisce una prova su Safari/iOS reale. La stampa PDF usa la finestra di stampa del browser: scegliere **Salva come PDF** e formato **A4 orizzontale**.

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

## Strumenti dell’editor

- **Guida iniziale**: sul foglio vuoto puoi aggiungere una fornitura, scegliere un quadro o importare le utenze senza aprire la sidebar. I suggerimenti successivi accompagnano fino al collegamento e all’aggiunta delle utenze. Se parti da una fornitura, la libreria propone un ingresso compatibile; puoi cambiare i filtri.
- **Zoom e navigazione**: usa `−`, `+` o il menu dal 25% al 250%. **Adatta alla finestra** mostra l’intero foglio e segue le dimensioni disponibili, anche quando apri le proprietà. **Sposta foglio** permette di trascinarlo senza muovere gli elementi. Sono disponibili anche barra spaziatrice + trascinamento, pulsante centrale del mouse e `Ctrl/Cmd + rotellina` per lo zoom. Lo zoom non modifica il progetto o il PDF.
- **Controlli**: il pulsante mostra il numero di errori e avvisi. **Vai all’elemento** apre la pagina corretta e seleziona il nodo o il collegamento da correggere. Gli errori bloccano salvataggio e stampa; le utenze non collegate sono avvisi.
- **Libreria quadri**: cerca per matricola, corrente o ingresso, filtra i risultati e consulta le prese libere rispetto al totale. **Mostra anche i quadri già in uso** permette di verificarne la disponibilità senza aggiungere una seconda copia fisica. Le prese sono riepilogate anche nelle proprietà di un quadro.
- **Selezione multipla**: selezionando almeno due elementi compare una barra con Collega, Ordina, Allinea, Duplica ed Elimina. Le azioni non disponibili indicano il motivo. Duplica agisce sulle utenze della selezione.
- **Pagine**: la panoramica mostra miniature, numero di utenze e nomi modificabili. I nomi vengono conservati nel JSON e seguono inserimento, eliminazione, annulla e ripristina; la numerazione tecnica del PDF resta numerica.

I messaggi distinguono conferme, informazioni, avvisi ed errori. I comandi principali hanno testo da almeno 14 px e aree di tocco da almeno 44 px; il foglio tecnico conserva la propria tipografia.

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
- **Riprendi il lavoro** riapre il progetto recuperabile; esportarlo in JSON per conservarne una copia.
- Aprire un altro progetto mantiene il recupero precedente fino alla prima modifica o esportazione del nuovo progetto.
- L’autosalvataggio dipende dallo spazio e dalle impostazioni del browser. In caso di indisponibilità compare un messaggio; il file JSON rimane il modo per trasferire e conservare un progetto.
- Undo e redo sono disponibili dalla barra superiore.

Scorciatoie:

- `Cmd/Ctrl + Z`: annulla;
- `Cmd/Ctrl + Maiusc + Z` oppure `Cmd/Ctrl + Y`: ripristina;
- `Canc`/`Backspace`: elimina la selezione;
- `Maiusc` o `Cmd/Ctrl + clic`: selezione multipla;
- `Cmd/Ctrl + A` con il focus sul disegno: seleziona tutti gli elementi della pagina;
- `Esc`: toglie la selezione, disattiva lo spostamento del foglio e chiude gli strumenti su mobile;
- barra spaziatrice + trascinamento: sposta la vista del foglio quando il focus non è su un controllo o un elemento selezionabile.

## Pagine e layout

La pagina corrente si seleziona dalla barra sopra il disegno. Le pagine possono essere aggiunte o eliminate.

Una pagina contiene al massimo 18 utenze disposte automaticamente senza sovrapposizioni. Se un’aggiunta o un’importazione supera questo limite, vengono create nuove pagine. Quando necessario, il quadro di origine viene richiamato automaticamente sulla nuova pagina mantenendo condivisa la disponibilità fisica delle prese.

Le Proprietà occupano una colonna dedicata su desktop e una zona sotto il disegno su tablet e mobile, senza sovrapporsi al foglio. Su mobile la barra degli strumenti è richiudibile e l’area del disegno può scorrere orizzontalmente. Il cartiglio si espande per contenere indirizzo e partita IVA.

In **Disponi**, i comandi **Spazia in verticale** e **Spazia in orizzontale** rendono uguali gli spazi fra gli elementi selezionati, anche se hanno altezze diverse. Se non ci sono elementi selezionati, si applicano alle utenze della pagina. Servono almeno tre elementi.

## Socapex e testo dei collegamenti

Per i quadri PB63A da #1 a #18, ogni Socapex occupa un banco distinto: **R1, R2, S5, S6, T9, T10**, poi **R3, R4, S7, S8, T11, T12**. Un gruppo parziale non cede le sue prese residue al Socapex successivo: con cinque utenze nel primo gruppo, il secondo parte comunque da R3. Gli altri quadri continuano a utilizzare le prese compatibili libere.

Per correggere un gruppo già creato, selezionare il collegamento Socapex e usare **Riassegna prese al banco libero**. Le assegnazioni esistenti non vengono cambiate automaticamente all’apertura del file.

Nelle proprietà di un collegamento, **Mostra sezione cavo** e **Mostra lunghezza** consentono di nascondere questi testi nello schema e nel PDF. I valori restano modificabili e vengono conservati nel progetto JSON.

## Ditte esecutrici

Ogni nuovo progetto parte con i dati della ditta vuoti, anche se il progetto precedente aveva una ditta compilata. **Salva ditta in rubrica** memorizza denominazione, indirizzo e partita IVA nel browser; la ditta si richiama dal menu **Rubrica ditte**. Le modifiche ai campi del progetto aggiornano la rubrica solo premendo di nuovo il pulsante di salvataggio della ditta. La rubrica è separata dai progetti JSON e non viene trasferita esportando un progetto.

La ricerca del luogo usa il campo **Cerca indirizzo** oppure, se vuoto, l’indirizzo già compilato nei campi Via, CAP, Comune e Provincia.

## Esportazione PDF

Il documento contiene la copertina, l’indice quando sono presenti più schemi, le tavole e il riepilogo finale, in A4 orizzontale.

- **Indice compatto**: tabella con righe alternate, forniture e quadri residenti, intervalli di pagine consecutivi e collegamenti interni agli schemi. I richiami dello stesso elemento fisico confluiscono nella stessa voce. Le pagine prive di una fornitura o di un quadro hanno comunque un riferimento nell’indice.
- **Riepilogo carichi**: potenza assegnata, potenza e corrente stimata per fase, percentuali sul totale, sbilanciamento e dettaglio per fornitura o quadro con i riferimenti alle tavole. Le utenze non collegate non contribuiscono ai valori; conteggi, elenchi di utenze escluse e note di progetto non sono stampati nel riepilogo.
- **Impaginazione automatica**: indice e dettaglio carichi proseguono su altre pagine quando necessario, senza ridurre il carattere. Nomi lunghi e cartigli vengono misurati prima della stampa; la numerazione tiene conto di tutte le pagine aggiunte e degli schemi effettivamente esportati.

Le barre delle fasi hanno scala 0-100% della potenza assegnata. Lo scostamento indica il massimo scarto assoluto dalla potenza media per fase, diviso per la media; a carico nullo vale zero. I criteri di calcolo sono riportati in fondo al riepilogo.

## Progetti precedenti

I progetti con schema precedente alla versione 6 vengono migrati automaticamente:

- conversione del vecchio nodo Socapex;
- generazione delle chiavi fisiche per forniture e quadri richiamati;
- conversione dei vecchi PowerLock;
- normalizzazione e rinumerazione delle pagine.

File privi della struttura progetto, collegamenti orfani, identificativi non validi e versioni future dello schema vengono rifiutati senza sostituire il progetto aperto. I progetti con anomalie di collegamento vengono aperti con una segnalazione e devono essere corretti prima del salvataggio o della stampa. Le migrazioni non riscrivono i cavi dei progetti già in versione 6.

## Test

```bash
npm test
npm run check
```

`npm run check` verifica la sintassi di `core.js`, `viewport.js` e `app.js`, quindi esegue i test del dominio elettrico e dello schema progetto.

Per i test dell’interfaccia:

```bash
npm ci
npm run test:browser:install
npm run test:browser
```

La suite avvia un server locale e verifica creazione, collegamenti, download JSON, recupero, import Capture, apertura come file locale, trascinamento, tastiera e layout mobile in Firefox e WebKit. Verifica anche le dimensioni e il ciclo di vita delle pagine di stampa simulando la finestra di stampa; il salvataggio PDF della finestra nativa resta una verifica manuale.

## Struttura

- `core.js`: schema, migrazioni, normalizzazione, compatibilità, prese e validazione della topologia;
- `app.js`: stato, interfaccia, rendering SVG, importazione, layout e stampa;
- `viewport.js`: zoom, adattamento e spostamento della vista del foglio;
- `index.html`: struttura dell’interfaccia;
- `styles.css`: layout a schermo, responsive e stampa;
- `tests/`: test automatici del dominio e dell’interfaccia;
- `playwright.config.js`: test dell’interfaccia in Firefox e WebKit;
- `examples/`: file di importazione di esempio.

La revisione e le proposte per l’interfaccia sono in [`docs/REVISIONE.md`](docs/REVISIONE.md).

## Pubblicazione

Il progetto è composto soltanto da file statici e può essere pubblicato direttamente con GitHub Pages. Prima della pubblicazione eseguire:

```bash
npm run check
```

## Licenza

GNU GPL v3.
