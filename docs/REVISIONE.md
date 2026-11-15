# Revisione del progetto — 11 novembre 2026

## Pulizia e correzioni

- Rimosse le modalità alternative dei quadri: nessun modello della libreria le utilizzava. Eliminati menu, gestori e campo `panelMode` ormai senza effetto.
- Rimossa la copia della libreria dallo stato del progetto, insieme a funzioni duplicate, adattatori inutilizzati e allo stato vuoto dell’ispettore che non poteva essere visualizzato.
- Centralizzate nel dominio le conversioni dei vecchi file e il riconoscimento degli elementi fisici condivisi fra pagine. La migrazione lavora su copie e non modifica l’oggetto originale.
- Limitate le migrazioni agli schemi precedenti alla versione 6: un cavo errato in un progetto corrente viene segnalato, senza essere sostituito silenziosamente.
- Corretti il pulsante del quadro temporaneo, il recupero dell’autosalvataggio e la conservazione del recupero precedente quando si apre un altro file.
- Corretto il controllo di forniture già utilizzate e cicli che attraversano i richiami di quadri su altre pagine.
- Riordinato il CSS in regole leggibili e consolidata la gestione degli elementi nascosti.
- Aggiornata la documentazione della ricerca indirizzi: la chiamata facoltativa a Photon era già presente nell’app.

## Compatibilità e accessibilità

- Identificativi UUID generati con `getRandomValues` quando `randomUUID` non è disponibile.
- Un solo gestore del trascinamento, con cattura sull’SVG stabile e rilascio su `pointerup`, `pointercancel`, perdita della cattura e perdita del focus della finestra.
- Gesti touch sugli elementi distinti dallo scorrimento sullo sfondo del foglio.
- Pagine di stampa mantenute fino a `afterprint`, anche se la chiamata di stampa restituisce subito il controllo. La stessa preparazione viene usata dalla stampa da tastiera.
- Corretto il contenitore delle pagine di stampa; ID e marker SVG univoci per ogni pagina, senza maniglie o selezioni nel documento stampato.
- Apertura file tramite pulsanti nativi utilizzabili da tastiera; nomi accessibili dei dialoghi e ripristino del focus sugli elementi SVG dopo il ridisegno.
- Scorciatoie del disegno sospese nei dialoghi; una sola gestione della cancellazione da tastiera.
- Rimossa la dipendenza da `:has` per l’opzione Socapex disabilitata. Aggiunti valori di riserva per dimensioni della finestra e titolo del foglio.
- Barra superiore adattabile alle finestre strette e campi touch che evitano lo zoom automatico su iPhone. Rispettata la preferenza di riduzione delle animazioni.
- Ricerca indirizzi interrotta alla chiusura del dialogo, con tempo massimo e possibilità di riprovare.

## Correzioni delle annotazioni dell’11 novembre

- Cartiglio con altezza adattabile: indirizzo e partita IVA restano all’interno delle celle.
- Ricerca indirizzi verificata con richieste reali da file locale in Firefox e WebKit; il comando cerca anche nei campi dell’indirizzo se il campo di ricerca è vuoto. Test di recupero dopo un errore del servizio.
- Ditta vuota nei nuovi progetti e rubrica locale con salvataggio, richiamo e rimozione espliciti.
- Menu “Tipo di collegamento” coerente con il connettore reale, incluso il PowerLock generico dei progetti esistenti.
- Opzioni per nascondere sezione e lunghezza nello schema e nel PDF, mantenendo i valori nel JSON.
- Sottotitolo vuoto nei nuovi quadri.
- Proprietà in una zona dedicata a destra o sotto il foglio, senza sovrapposizioni.
- Comandi di distribuzione con spazi uguali fra i bordi degli elementi.
- Banchi Socapex distinti sui PB63A #1–#18: un secondo gruppo parte da R3 anche se T10 è rimasta libera. Comando di riassegnazione per correggere esplicitamente i gruppi esistenti.

## Proposte di usabilità e design integrate

Tutte le proposte della revisione sono ora integrate nell’editor. Il documento stampato mantiene il proprio stile tecnico e le proprie dimensioni, indipendentemente dallo zoom della vista.

| Stato | Modifica | Problema risolto | Criterio di verifica |
| --- | --- | --- | --- |
| Completata | Guida nel foglio vuoto con tre azioni: “Aggiungi fornitura”, “Scegli quadro”, “Importa utenze” | Dopo la creazione del progetto non era chiaro da dove iniziare | Verificato il flusso fino al primo collegamento con ingresso compatibile |
| Completata | Zoom, “Adatta alla finestra” e spostamento del foglio | Su mobile il foglio aveva larghezza minima; su desktop molti elementi risultavano piccoli | Zoom manuale 25–250%, adattamento, trascinamento e stampa senza ingrandimento verificati |
| Completata | Pannello Proprietà in una zona dedicata e richiudibile | Il pannello flottante copriva un’utenza o l’arrivo di una linea | Verificata l’assenza di sovrapposizioni a 1218, 897 e 390 px |
| Completata | Messaggi distinti per esito, avviso ed errore; elenco delle anomalie con “Vai all’elemento” | Anche le operazioni riuscite avevano testo rosso; un solo messaggio non aiutava a correggere più anomalie | Verificata la navigazione a un errore su un’altra pagina, la correzione della presa e l’aggiornamento del conteggio |
| Completata | Ricerca nella libreria per matricola, corrente e tipo di ingresso, mostrando prese libere e totali | Le scelte richiedevano passaggi fra più menu e il conteggio della disponibilità | Ricerca, filtri, esclusione dei quadri in uso e riepiloghi delle prese verificati |
| Completata | Barra contestuale per selezione multipla: collega, ordina, allinea, duplica, elimina | Le azioni sulla selezione erano distribuite fra sidebar e ispettore | Verificati duplicazione e collegamento multiplo; le azioni disabilitate mostrano il motivo |
| Completata | Elenco pagine con miniatura, numero utenze e nome modificabile | L’elenco “Pagina N” diventava poco leggibile nei progetti grandi | Miniature e nomi salvati nel JSON; verificati inserimento, eliminazione, annulla e recupero |
| Completata | Gerarchia visiva uniforme: comandi da almeno 14 px, spaziatura coerente, meno bordi, pulsante principale per ogni dialogo | Molte etichette e comandi avevano testo da 9–11 px e peso visivo simile | Controllate dimensioni dei comandi e dei menu nativi, anche in WebKit |

La vista è gestita da `viewport.js`, senza introdurre un framework o dipendenze da caricare nel browser. I nomi delle pagine sono un campo facoltativo dello schema JSON versione 6. Gli strumenti nascosti su mobile vengono esclusi dal percorso da tastiera; la preferenza di riduzione delle animazioni rimane rispettata.

## Impaginazione PDF integrata - 15 novembre 2026

- Integrate nell'esportazione le due bozze approvate: indice tabellare compatto e riepilogo dei carichi con la stessa gerarchia visiva.
- Indice con intervalli consecutivi, destinazioni interne e raggruppamento delle istanze per alimentazione fisica. Inclusi i quadri residenti senza una fornitura esplicita e le pagine non coperte dalle altre voci.
- Riepilogo con potenza assegnata, quote sul totale, correnti, sbilanciamento e valori per fornitura o quadro. Nessun conteggio di utenze, elenco di utenze escluse o nota di progetto; i valori non comprendono le utenze prive di collegamento fisico.
- Impaginazione misurata sulle righe effettive e sul cartiglio, con pagine di seguito per elenchi lunghi. Riferimenti e numerazione vengono determinati prima di generare gli schemi.
- Verificati indice a una pagina con 15 alimentazioni, 35 nomi lunghi con indirizzo esteso, carico nullo, richiami tra pagine e ripristino della numerazione dell'editor dopo la stampa. Controllo visivo delle pagine in WebKit.

## Verifiche

- Verifica del 15 novembre 2026: controlli di sintassi e dominio superati; **62 test dell’interfaccia superati** su Firefox e WebKit, comprese le nuove pagine di stampa.
- Test del dominio e delle migrazioni: `npm run check`.
- Suite dell’interfaccia: `npm run test:browser`, con gli stessi scenari in Firefox e WebKit.
- Le prove di stampa automatizzate controllano preparazione, dimensioni, numerazione, marker e pulizia delle pagine. Il PDF prodotto dalla finestra nativa e il comportamento su dispositivi Safari/iOS reali richiedono una verifica manuale.

Riferimenti tecnici consultati: [UUID e contesti sicuri](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID), [cattura dei pointer](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture), [evento afterprint](https://developer.mozilla.org/en-US/docs/Web/API/Window/afterprint_event).
