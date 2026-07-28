# Unifilari ATS

Prototipo locale e statico per creare schemi unifilari di distribuzione elettrica per eventi.

## Avvio

Aprire `index.html` con un browser moderno. Non richiede installazione né server: è pronto anche per la pubblicazione su GitHub Pages.

## Flusso di lavoro

1. Compilare i dati del progetto nella barra laterale.
2. Importare la libreria dei quadri (`Matricola;In;Out;Qta`) e il CSV esportato da Capture.
3. Importare prima la libreria quadri, poi usare **Quadro** e scegliere la matricola dal database.
4. Trascinare il pallino blu a destra di un blocco sopra un altro blocco per creare subito il collegamento. Selezionando una linea si possono modificare cavo e lunghezza o eliminarla; selezionando un'utenza, **Scollega dal quadro / fornitura** rimuove solo il collegamento.
5. Trascinare gli elementi per correggere il layout e completare i dati nel pannello Proprietà.
5. Salvare il file progetto `.json` oppure usare **Esporta PDF** e scegliere “Salva come PDF” nel pannello del browser.

Il CSV Capture viene aggregato per campo `Circuit`; gli assorbimenti sono la somma del campo `Wattage` delle fixture appartenenti allo stesso circuito.
