import "jspdf";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

interface ReportRequest {
  client_id: string;
  report_month: number;
  report_year: number;
  date_from?: string; // ISO date e.g. "2026-01-01"
  date_to?: string;   // ISO date e.g. "2026-03-15"
}

// ══════════════════════════════════════════════════════════════
// TRANSLATIONS — per-client language for PDF text
// ══════════════════════════════════════════════════════════════
const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    performanceReport: 'PERFORMANCE REPORT',
    preparedFor: 'Prepared for',
    preparedBy: 'Prepared by',
    tableOfContents: 'Table of Contents',
    reportCovers: 'This report covers performance from',
    allFigures: 'All figures compared to',
    unlessStated: 'unless stated otherwise',
    noDataAvailable: 'No data available for this period',
    whatThisMeans: 'WHAT THIS MEANS FOR YOU',
    monthOnMonth: 'Month-on-Month Comparison',
    topContent: 'TOP PERFORMING CONTENT',
    metric: 'METRIC',
    thisMonth: 'THIS MONTH',
    lastMonth: 'LAST MONTH',
    thisPeriod: 'THIS PERIOD',
    previousPeriod: 'PREVIOUS PERIOD',
    change: 'CHANGE',
    monthlySummary: 'Monthly Summary',
    platformStatus: 'Platform Status Overview',
    platform: 'PLATFORM',
    status: 'STATUS',
    verdict: 'VERDICT',
    keyWins: 'Key Wins This Month',
    worthWatching: 'Worth Watching',
    strong: 'Strong',
    steady: 'Steady',
    needsAttention: 'Needs Attention',
    noteFrom: 'A Note from',
    interested: 'Interested? Reply to this email or call us.',
    readyToGrow: 'READY TO GROW?',
    thankYou: 'THANK YOU,',
    closingLine: 'This report gives you a clear picture of where things stand. Every number here represents real people discovering your business. We look forward to building on this next month.',
    confidential: 'Confidential',
    newThisMonth: 'New',
    noChange: 'No change',
    vsLastMonth: 'vs last month',
    firstMonthNote: 'This is the first month of tracked data. No previous month comparison is available yet.',
    standoutResult: 'The standout result this month was',
    whichReached: 'which reached',
    upFrom: 'up',
    fromLastMonth: 'from last month',
    engagementRate: 'Your engagement rate is',
    strongEngagement: '— your audience is actively responding to your content.',
    solidBaseline: '— a solid baseline, with room to grow through more interactive content.',
    lowEngagement: '— consider experimenting with different content formats to encourage more interaction.',
    gained: 'You gained',
    newFollowers: 'new followers this month, bringing your total to',
    heldSteady: 'Your follower count held steady at',
    postPublished: 'Post published on',
    page: 'Page',
    performanceMetrics: 'Performance Metrics',
    firstMonthTracked: 'This is your first month tracked for this platform — no comparison data available yet.',
    noPreviousData: 'No previous month data available for comparison.',
    firstReportingMonth: 'This is your first reporting month — we\'ll track improvements from here.',
    overallPerformance: 'Overall performance across all platforms with traffic light status',
    serviceRecommendation: 'A service recommendation based on your results',
    comparison: 'Comparison',
    feature: 'FEATURE',
    optionA: 'OPTION A',
    optionB: 'OPTION B',
    interestedCall: 'Interested? Reply to this email or call us at',
  },
  fr: {
    performanceReport: 'RAPPORT DE PERFORMANCE',
    preparedFor: 'Préparé pour',
    preparedBy: 'Préparé par',
    tableOfContents: 'Table des matières',
    reportCovers: 'Ce rapport couvre les performances du',
    allFigures: 'Tous les chiffres sont comparés à',
    unlessStated: 'sauf indication contraire',
    noDataAvailable: 'Aucune donnée disponible pour cette période',
    whatThisMeans: 'CE QUE CELA SIGNIFIE POUR VOUS',
    monthOnMonth: 'Comparaison mois par mois',
    topContent: 'CONTENU LE PLUS PERFORMANT',
    metric: 'MÉTRIQUE',
    thisMonth: 'CE MOIS',
    lastMonth: 'MOIS DERNIER',
    thisPeriod: 'CETTE PÉRIODE',
    previousPeriod: 'PÉRIODE PRÉCÉDENTE',
    change: 'VARIATION',
    monthlySummary: 'Résumé mensuel',
    platformStatus: 'Vue d\'ensemble des plateformes',
    platform: 'PLATEFORME',
    status: 'STATUT',
    verdict: 'VERDICT',
    keyWins: 'Points forts ce mois',
    worthWatching: 'À surveiller',
    strong: 'Fort',
    steady: 'Stable',
    needsAttention: 'Attention requise',
    noteFrom: 'Un message de',
    interested: 'Intéressé ? Répondez à cet e-mail ou appelez-nous.',
    readyToGrow: 'PRÊT À GRANDIR ?',
    thankYou: 'MERCI,',
    closingLine: 'Ce rapport vous donne une image claire de la situation. Chaque chiffre représente de vraies personnes qui découvrent votre entreprise. Nous avons hâte de continuer sur cette lancée le mois prochain.',
    confidential: 'Confidentiel',
    newThisMonth: 'Nouveau',
    noChange: 'Pas de changement',
    vsLastMonth: 'vs mois dernier',
    firstMonthNote: 'C\'est le premier mois de données suivies. Aucune comparaison avec le mois précédent n\'est encore disponible.',
    standoutResult: 'Le meilleur résultat ce mois-ci était',
    whichReached: 'qui a atteint',
    upFrom: 'en hausse de',
    fromLastMonth: 'par rapport au mois dernier',
    engagementRate: 'Votre taux d\'engagement est de',
    strongEngagement: '— votre audience répond activement à votre contenu.',
    solidBaseline: '— une bonne base, avec de la marge pour progresser.',
    lowEngagement: '— essayez différents formats de contenu pour encourager plus d\'interactions.',
    gained: 'Vous avez gagné',
    newFollowers: 'nouveaux abonnés ce mois-ci, portant votre total à',
    heldSteady: 'Votre nombre d\'abonnés est resté stable à',
    postPublished: 'Publication du',
    page: 'Page',
    performanceMetrics: 'Métriques de performance',
    firstMonthTracked: 'C\'est votre premier mois suivi pour cette plateforme — aucune donnée de comparaison disponible.',
    noPreviousData: 'Aucune donnée du mois précédent disponible pour comparaison.',
    firstReportingMonth: 'C\'est votre premier mois de reporting — nous suivrons les améliorations à partir d\'ici.',
    overallPerformance: 'Performance globale sur toutes les plateformes avec indicateur de statut',
    serviceRecommendation: 'Une recommandation de service basée sur vos résultats',
    comparison: 'Comparaison',
    feature: 'FONCTIONNALITÉ',
    optionA: 'OPTION A',
    optionB: 'OPTION B',
    interestedCall: 'Intéressé ? Répondez à cet e-mail ou appelez-nous au',
  },
  de: {
    performanceReport: 'LEISTUNGSBERICHT',
    preparedFor: 'Erstellt für',
    preparedBy: 'Erstellt von',
    tableOfContents: 'Inhaltsverzeichnis',
    reportCovers: 'Dieser Bericht deckt die Leistung vom',
    allFigures: 'Alle Zahlen im Vergleich zu',
    unlessStated: 'sofern nicht anders angegeben',
    noDataAvailable: 'Keine Daten für diesen Zeitraum verfügbar',
    whatThisMeans: 'WAS DAS FÜR SIE BEDEUTET',
    monthOnMonth: 'Monatsvergleich',
    topContent: 'TOP-INHALTE',
    metric: 'KENNZAHL',
    thisMonth: 'DIESEN MONAT',
    lastMonth: 'LETZTEN MONAT',
    thisPeriod: 'DIESER ZEITRAUM',
    previousPeriod: 'VORHERIGER ZEITRAUM',
    change: 'ÄNDERUNG',
    monthlySummary: 'Monatszusammenfassung',
    platformStatus: 'Plattformübersicht',
    platform: 'PLATTFORM',
    status: 'STATUS',
    verdict: 'BEWERTUNG',
    keyWins: 'Highlights dieses Monats',
    worthWatching: 'Zu beobachten',
    strong: 'Stark',
    steady: 'Stabil',
    needsAttention: 'Aufmerksamkeit erforderlich',
    noteFrom: 'Eine Nachricht von',
    interested: 'Interessiert? Antworten Sie auf diese E-Mail oder rufen Sie uns an.',
    readyToGrow: 'BEREIT ZU WACHSEN?',
    thankYou: 'VIELEN DANK,',
    closingLine: 'Dieser Bericht gibt Ihnen ein klares Bild der aktuellen Lage. Jede Zahl steht für echte Menschen, die Ihr Unternehmen entdecken. Wir freuen uns darauf, im nächsten Monat daran anzuknüpfen.',
    confidential: 'Vertraulich',
    newThisMonth: 'Neu',
    noChange: 'Keine Änderung',
    vsLastMonth: 'vs. letzter Monat',
    firstMonthNote: 'Dies ist der erste Monat mit erfassten Daten. Noch kein Vormonatsvergleich verfügbar.',
    standoutResult: 'Das herausragende Ergebnis diesen Monat war',
    whichReached: 'das erreichte',
    upFrom: 'gestiegen um',
    fromLastMonth: 'im Vergleich zum Vormonat',
    engagementRate: 'Ihre Engagement-Rate beträgt',
    strongEngagement: '— Ihr Publikum reagiert aktiv auf Ihre Inhalte.',
    solidBaseline: '— eine solide Basis, mit Potenzial zum Wachstum.',
    lowEngagement: '— probieren Sie verschiedene Inhaltsformate aus, um mehr Interaktionen zu fördern.',
    gained: 'Sie haben',
    newFollowers: 'neue Follower diesen Monat gewonnen, Ihr Gesamtstand beträgt jetzt',
    heldSteady: 'Ihre Follower-Anzahl blieb stabil bei',
    postPublished: 'Veröffentlicht am',
    page: 'Seite',
    performanceMetrics: 'Leistungskennzahlen',
    firstMonthTracked: 'Dies ist Ihr erster erfasster Monat für diese Plattform — noch keine Vergleichsdaten verfügbar.',
    noPreviousData: 'Keine Vormonatsdaten zum Vergleich verfügbar.',
    firstReportingMonth: 'Dies ist Ihr erster Berichtsmonat — wir verfolgen die Verbesserungen ab hier.',
    overallPerformance: 'Gesamtleistung über alle Plattformen mit Statusampel',
    serviceRecommendation: 'Eine Serviceempfehlung basierend auf Ihren Ergebnissen',
    comparison: 'Vergleich',
    feature: 'MERKMAL',
    optionA: 'OPTION A',
    optionB: 'OPTION B',
    interestedCall: 'Interessiert? Antworten Sie auf diese E-Mail oder rufen Sie uns an unter',
  },
  es: {
    performanceReport: 'INFORME DE RENDIMIENTO',
    preparedFor: 'Preparado para',
    preparedBy: 'Preparado por',
    tableOfContents: 'Tabla de contenidos',
    reportCovers: 'Este informe cubre el rendimiento del',
    allFigures: 'Todas las cifras comparadas con',
    unlessStated: 'salvo indicación contraria',
    noDataAvailable: 'No hay datos disponibles para este período',
    whatThisMeans: 'LO QUE ESTO SIGNIFICA PARA USTED',
    monthOnMonth: 'Comparación mes a mes',
    topContent: 'CONTENIDO MÁS DESTACADO',
    metric: 'MÉTRICA',
    thisMonth: 'ESTE MES',
    lastMonth: 'MES PASADO',
    thisPeriod: 'ESTE PERÍODO',
    previousPeriod: 'PERÍODO ANTERIOR',
    change: 'CAMBIO',
    monthlySummary: 'Resumen mensual',
    platformStatus: 'Resumen de plataformas',
    platform: 'PLATAFORMA',
    status: 'ESTADO',
    verdict: 'VEREDICTO',
    keyWins: 'Logros de este mes',
    worthWatching: 'Vale la pena vigilar',
    strong: 'Fuerte',
    steady: 'Estable',
    needsAttention: 'Requiere atención',
    noteFrom: 'Un mensaje de',
    interested: '¿Interesado? Responda a este correo o llámenos.',
    readyToGrow: '¿LISTO PARA CRECER?',
    thankYou: 'GRACIAS,',
    closingLine: 'Este informe le da una imagen clara de dónde están las cosas. Cada número representa personas reales que descubren su negocio. Esperamos seguir avanzando el próximo mes.',
    confidential: 'Confidencial',
    newThisMonth: 'Nuevo',
    noChange: 'Sin cambios',
    vsLastMonth: 'vs mes anterior',
    firstMonthNote: 'Este es el primer mes de datos registrados. Aún no hay comparación con el mes anterior disponible.',
    standoutResult: 'El resultado destacado de este mes fue',
    whichReached: 'que alcanzó',
    upFrom: 'subió',
    fromLastMonth: 'respecto al mes pasado',
    engagementRate: 'Su tasa de participación es del',
    strongEngagement: '— su audiencia responde activamente a su contenido.',
    solidBaseline: '— una buena base, con margen para crecer.',
    lowEngagement: '— considere experimentar con diferentes formatos de contenido.',
    gained: 'Ganó',
    newFollowers: 'nuevos seguidores este mes, llevando su total a',
    heldSteady: 'Su número de seguidores se mantuvo estable en',
    postPublished: 'Publicado el',
    page: 'Página',
    performanceMetrics: 'Métricas de rendimiento',
    firstMonthTracked: 'Este es su primer mes registrado para esta plataforma — sin datos de comparación disponibles.',
    noPreviousData: 'Sin datos del mes anterior disponibles para comparación.',
    firstReportingMonth: 'Este es su primer mes de informes — seguiremos las mejoras a partir de aquí.',
    overallPerformance: 'Rendimiento general en todas las plataformas con indicador de estado',
    serviceRecommendation: 'Una recomendación de servicio basada en sus resultados',
    comparison: 'Comparación',
    feature: 'CARACTERÍSTICA',
    optionA: 'OPCIÓN A',
    optionB: 'OPCIÓN B',
    interestedCall: '¿Interesado? Responda a este correo o llámenos al',
  },
  it: {
    performanceReport: 'REPORT DI PERFORMANCE',
    preparedFor: 'Preparato per',
    preparedBy: 'Preparato da',
    tableOfContents: 'Indice',
    reportCovers: 'Questo report copre le performance dal',
    allFigures: 'Tutti i dati confrontati con',
    unlessStated: 'salvo diversa indicazione',
    noDataAvailable: 'Nessun dato disponibile per questo periodo',
    whatThisMeans: 'COSA SIGNIFICA PER TE',
    monthOnMonth: 'Confronto mese su mese',
    topContent: 'CONTENUTI TOP',
    metric: 'METRICA',
    thisMonth: 'QUESTO MESE',
    lastMonth: 'MESE SCORSO',
    thisPeriod: 'QUESTO PERIODO',
    previousPeriod: 'PERIODO PRECEDENTE',
    change: 'VARIAZIONE',
    monthlySummary: 'Riepilogo mensile',
    platformStatus: 'Panoramica piattaforme',
    platform: 'PIATTAFORMA',
    status: 'STATO',
    verdict: 'VALUTAZIONE',
    keyWins: 'Risultati chiave del mese',
    worthWatching: 'Da monitorare',
    strong: 'Forte',
    steady: 'Stabile',
    needsAttention: 'Richiede attenzione',
    noteFrom: 'Un messaggio da',
    interested: 'Interessato? Rispondi a questa email o chiamaci.',
    readyToGrow: 'PRONTO A CRESCERE?',
    thankYou: 'GRAZIE,',
    closingLine: 'Questo report ti dà un quadro chiaro della situazione. Ogni numero rappresenta persone reali che scoprono la tua attività. Non vediamo l\'ora di costruire su questi risultati il prossimo mese.',
    confidential: 'Riservato',
    newThisMonth: 'Nuovo',
    noChange: 'Nessun cambiamento',
    vsLastMonth: 'vs mese precedente',
    firstMonthNote: 'Questo è il primo mese di dati tracciati. Nessun confronto con il mese precedente ancora disponibile.',
    standoutResult: 'Il risultato di spicco di questo mese è stato',
    whichReached: 'che ha raggiunto',
    upFrom: 'in aumento del',
    fromLastMonth: 'rispetto al mese scorso',
    engagementRate: 'Il tuo tasso di coinvolgimento è del',
    strongEngagement: '— il tuo pubblico risponde attivamente ai tuoi contenuti.',
    solidBaseline: '— una buona base, con margine di crescita.',
    lowEngagement: '— considera di sperimentare diversi formati di contenuto.',
    gained: 'Hai guadagnato',
    newFollowers: 'nuovi follower questo mese, portando il totale a',
    heldSteady: 'Il numero di follower è rimasto stabile a',
    postPublished: 'Pubblicato il',
    page: 'Pagina',
    performanceMetrics: 'Metriche di performance',
    firstMonthTracked: 'Questo è il tuo primo mese tracciato per questa piattaforma — nessun dato di confronto disponibile.',
    noPreviousData: 'Nessun dato del mese precedente disponibile per il confronto.',
    firstReportingMonth: 'Questo è il tuo primo mese di reporting — monitoreremo i miglioramenti da qui.',
    overallPerformance: 'Performance complessiva su tutte le piattaforme con indicatore di stato',
    serviceRecommendation: 'Una raccomandazione di servizio basata sui tuoi risultati',
    comparison: 'Confronto',
    feature: 'CARATTERISTICA',
    optionA: 'OPZIONE A',
    optionB: 'OPZIONE B',
    interestedCall: 'Interessato? Rispondi a questa email o chiamaci al',
  },
  nl: {
    performanceReport: 'PRESTATIERAPPORT',
    preparedFor: 'Opgesteld voor',
    preparedBy: 'Opgesteld door',
    tableOfContents: 'Inhoudsopgave',
    reportCovers: 'Dit rapport dekt de prestaties van',
    allFigures: 'Alle cijfers vergeleken met',
    unlessStated: 'tenzij anders vermeld',
    noDataAvailable: 'Geen gegevens beschikbaar voor deze periode',
    whatThisMeans: 'WAT DIT VOOR U BETEKENT',
    monthOnMonth: 'Maand-op-maand vergelijking',
    topContent: 'BEST PRESTERENDE CONTENT',
    metric: 'MAATSTAF',
    thisMonth: 'DEZE MAAND',
    lastMonth: 'VORIGE MAAND',
    thisPeriod: 'DEZE PERIODE',
    previousPeriod: 'VORIGE PERIODE',
    change: 'WIJZIGING',
    monthlySummary: 'Maandoverzicht',
    platformStatus: 'Platform overzicht',
    platform: 'PLATFORM',
    status: 'STATUS',
    verdict: 'OORDEEL',
    keyWins: 'Hoogtepunten deze maand',
    worthWatching: 'Aandachtspunten',
    strong: 'Sterk',
    steady: 'Stabiel',
    needsAttention: 'Aandacht vereist',
    noteFrom: 'Een bericht van',
    interested: 'Geïnteresseerd? Antwoord op deze e-mail of bel ons.',
    readyToGrow: 'KLAAR OM TE GROEIEN?',
    thankYou: 'BEDANKT,',
    closingLine: 'Dit rapport geeft u een duidelijk beeld van de situatie. Elk getal vertegenwoordigt echte mensen die uw bedrijf ontdekken. We kijken ernaar uit om hier volgend maand op voort te bouwen.',
    confidential: 'Vertrouwelijk',
    newThisMonth: 'Nieuw',
    noChange: 'Geen wijziging',
    vsLastMonth: 'vs vorige maand',
    firstMonthNote: 'Dit is de eerste maand met bijgehouden gegevens. Nog geen vergelijking met vorige maand beschikbaar.',
    standoutResult: 'Het uitstekende resultaat deze maand was',
    whichReached: 'dat bereikte',
    upFrom: 'gestegen met',
    fromLastMonth: 'ten opzichte van vorige maand',
    engagementRate: 'Uw engagementpercentage is',
    strongEngagement: '— uw publiek reageert actief op uw content.',
    solidBaseline: '— een solide basis, met ruimte voor groei.',
    lowEngagement: '— overweeg andere contentformaten om meer interactie te stimuleren.',
    gained: 'U won',
    newFollowers: 'nieuwe volgers deze maand, waarmee uw totaal komt op',
    heldSteady: 'Uw aantal volgers bleef stabiel op',
    postPublished: 'Gepubliceerd op',
    page: 'Pagina',
    performanceMetrics: 'Prestatiecijfers',
    firstMonthTracked: 'Dit is uw eerste bijgehouden maand voor dit platform — nog geen vergelijkingsgegevens beschikbaar.',
    noPreviousData: 'Geen gegevens van vorige maand beschikbaar voor vergelijking.',
    firstReportingMonth: 'Dit is uw eerste rapportagemaand — we volgen de verbeteringen vanaf hier.',
    overallPerformance: 'Algemene prestaties op alle platforms met statusindicator',
    serviceRecommendation: 'Een serviceaanbeveling gebaseerd op uw resultaten',
    comparison: 'Vergelijking',
    feature: 'KENMERK',
    optionA: 'OPTIE A',
    optionB: 'OPTIE B',
    interestedCall: 'Geïnteresseerd? Antwoord op deze e-mail of bel ons op',
  },
  pt: {
    performanceReport: 'RELATÓRIO DE DESEMPENHO',
    preparedFor: 'Preparado para',
    preparedBy: 'Preparado por',
    tableOfContents: 'Índice',
    reportCovers: 'Este relatório cobre o desempenho de',
    allFigures: 'Todos os números comparados com',
    unlessStated: 'salvo indicação em contrário',
    noDataAvailable: 'Sem dados disponíveis para este período',
    whatThisMeans: 'O QUE ISSO SIGNIFICA PARA VOCÊ',
    monthOnMonth: 'Comparação mês a mês',
    topContent: 'CONTEÚDO DE MELHOR DESEMPENHO',
    metric: 'MÉTRICA',
    thisMonth: 'ESTE MÊS',
    lastMonth: 'MÊS PASSADO',
    thisPeriod: 'ESTE PERÍODO',
    previousPeriod: 'PERÍODO ANTERIOR',
    change: 'VARIAÇÃO',
    monthlySummary: 'Resumo mensal',
    platformStatus: 'Visão geral das plataformas',
    platform: 'PLATAFORMA',
    status: 'STATUS',
    verdict: 'VEREDICTO',
    keyWins: 'Destaques do mês',
    worthWatching: 'Vale monitorar',
    strong: 'Forte',
    steady: 'Estável',
    needsAttention: 'Requer atenção',
    noteFrom: 'Uma mensagem de',
    interested: 'Interessado? Responda a este e-mail ou ligue para nós.',
    readyToGrow: 'PRONTO PARA CRESCER?',
    thankYou: 'OBRIGADO,',
    closingLine: 'Este relatório fornece uma visão clara de onde as coisas estão. Cada número representa pessoas reais descobrindo seu negócio. Aguardamos construir sobre esses resultados no próximo mês.',
    confidential: 'Confidencial',
    newThisMonth: 'Novo',
    noChange: 'Sem alteração',
    vsLastMonth: 'vs mês anterior',
    firstMonthNote: 'Este é o primeiro mês de dados rastreados. Ainda não há comparação com o mês anterior disponível.',
    standoutResult: 'O resultado de destaque deste mês foi',
    whichReached: 'que atingiu',
    upFrom: 'aumentou',
    fromLastMonth: 'em relação ao mês anterior',
    engagementRate: 'Sua taxa de engajamento é de',
    strongEngagement: '— seu público responde ativamente ao seu conteúdo.',
    solidBaseline: '— uma boa base, com espaço para crescer.',
    lowEngagement: '— considere experimentar diferentes formatos de conteúdo.',
    gained: 'Você ganhou',
    newFollowers: 'novos seguidores este mês, levando seu total para',
    heldSteady: 'Seu número de seguidores permaneceu estável em',
    postPublished: 'Publicado em',
    page: 'Página',
    performanceMetrics: 'Métricas de desempenho',
    firstMonthTracked: 'Este é seu primeiro mês rastreado para esta plataforma — sem dados de comparação disponíveis.',
    noPreviousData: 'Sem dados do mês anterior disponíveis para comparação.',
    firstReportingMonth: 'Este é seu primeiro mês de relatório — acompanharemos as melhorias a partir daqui.',
    overallPerformance: 'Desempenho geral em todas as plataformas com indicador de status',
    serviceRecommendation: 'Uma recomendação de serviço baseada em seus resultados',
    comparison: 'Comparação',
    feature: 'RECURSO',
    optionA: 'OPÇÃO A',
    optionB: 'OPÇÃO B',
    interestedCall: 'Interessado? Responda a este e-mail ou ligue para nós no',
  },
  pl: {
    performanceReport: 'RAPORT WYNIKÓW',
    preparedFor: 'Przygotowano dla',
    preparedBy: 'Przygotowano przez',
    tableOfContents: 'Spis treści',
    reportCovers: 'Raport obejmuje wyniki od',
    allFigures: 'Wszystkie liczby porównane z',
    unlessStated: 'chyba że zaznaczono inaczej',
    noDataAvailable: 'Brak danych za ten okres',
    whatThisMeans: 'CO TO OZNACZA DLA CIEBIE',
    monthOnMonth: 'Porównanie miesiąc do miesiąca',
    topContent: 'NAJLEPSZE TREŚCI',
    metric: 'WSKAŹNIK',
    thisMonth: 'TEN MIESIĄC',
    lastMonth: 'POPRZEDNI MIESIĄC',
    thisPeriod: 'TEN OKRES',
    previousPeriod: 'POPRZEDNI OKRES',
    change: 'ZMIANA',
    monthlySummary: 'Podsumowanie miesięczne',
    platformStatus: 'Przegląd platform',
    platform: 'PLATFORMA',
    status: 'STATUS',
    verdict: 'OCENA',
    keyWins: 'Sukcesy tego miesiąca',
    worthWatching: 'Warto obserwować',
    strong: 'Mocny',
    steady: 'Stabilny',
    needsAttention: 'Wymaga uwagi',
    noteFrom: 'Wiadomość od',
    interested: 'Zainteresowany? Odpowiedz na tego maila lub zadzwoń do nas.',
    readyToGrow: 'GOTOWY NA ROZWÓJ?',
    thankYou: 'DZIĘKUJEMY,',
    closingLine: 'Ten raport daje Ci jasny obraz sytuacji. Każda liczba reprezentuje prawdziwych ludzi odkrywających Twój biznes. Z niecierpliwością czekamy na budowanie na tych wynikach w przyszłym miesiącu.',
    confidential: 'Poufne',
    newThisMonth: 'Nowy',
    noChange: 'Bez zmian',
    vsLastMonth: 'vs poprzedni miesiąc',
    firstMonthNote: 'To pierwszy miesiąc śledzonych danych. Porównanie z poprzednim miesiącem nie jest jeszcze dostępne.',
    standoutResult: 'Wyróżniającym wynikiem w tym miesiącu był',
    whichReached: 'który osiągnął',
    upFrom: 'wzrost o',
    fromLastMonth: 'w porównaniu z poprzednim miesiącem',
    engagementRate: 'Twój wskaźnik zaangażowania wynosi',
    strongEngagement: '— Twoi odbiorcy aktywnie reagują na Twoje treści.',
    solidBaseline: '— solidna baza z miejscem na rozwój.',
    lowEngagement: '— rozważ eksperymentowanie z różnymi formatami treści.',
    gained: 'Zyskałeś',
    newFollowers: 'nowych obserwujących w tym miesiącu, całkowita liczba wynosi teraz',
    heldSteady: 'Liczba obserwujących pozostała stabilna na poziomie',
    postPublished: 'Opublikowano',
    page: 'Strona',
    performanceMetrics: 'Wskaźniki wydajności',
    firstMonthTracked: 'To Twój pierwszy miesiąc śledzony dla tej platformy — brak danych porównawczych.',
    noPreviousData: 'Brak danych z poprzedniego miesiąca do porównania.',
    firstReportingMonth: 'To Twój pierwszy miesiąc raportowania — będziemy śledzić postępy od teraz.',
    overallPerformance: 'Ogólna wydajność na wszystkich platformach ze wskaźnikiem statusu',
    serviceRecommendation: 'Rekomendacja usługi na podstawie Twoich wyników',
    comparison: 'Porównanie',
    feature: 'CECHA',
    optionA: 'OPCJA A',
    optionB: 'OPCJA B',
    interestedCall: 'Zainteresowany? Odpowiedz na tego maila lub zadzwoń do nas pod numer',
  },
  da: {
    performanceReport: 'YDELSESRAPPORT',
    preparedFor: 'Udarbejdet til',
    preparedBy: 'Udarbejdet af',
    tableOfContents: 'Indholdsfortegnelse',
    reportCovers: 'Denne rapport dækker resultaterne fra',
    allFigures: 'Alle tal sammenlignet med',
    unlessStated: 'medmindre andet er angivet',
    noDataAvailable: 'Ingen data tilgængelig for denne periode',
    whatThisMeans: 'HVAD DETTE BETYDER FOR DIG',
    monthOnMonth: 'Måned-til-måned sammenligning',
    topContent: 'BEDST YDENDE INDHOLD',
    metric: 'MÅLETAL',
    thisMonth: 'DENNE MÅNED',
    lastMonth: 'SIDSTE MÅNED',
    thisPeriod: 'DENNE PERIODE',
    previousPeriod: 'FORRIGE PERIODE',
    change: 'ÆNDRING',
    monthlySummary: 'Månedsoversigt',
    platformStatus: 'Platformsoversigt',
    platform: 'PLATFORM',
    status: 'STATUS',
    verdict: 'VURDERING',
    keyWins: 'Højdepunkter denne måned',
    worthWatching: 'Værd at følge',
    strong: 'Stærk',
    steady: 'Stabil',
    needsAttention: 'Kræver opmærksomhed',
    noteFrom: 'En besked fra',
    interested: 'Interesseret? Svar på denne e-mail eller ring til os.',
    readyToGrow: 'KLAR TIL AT VOKSE?',
    thankYou: 'TAK,',
    closingLine: 'Denne rapport giver dig et klart billede af situationen. Hvert tal repræsenterer rigtige mennesker, der opdager din virksomhed. Vi ser frem til at bygge videre på disse resultater næste måned.',
    confidential: 'Fortroligt',
    newThisMonth: 'Ny',
    noChange: 'Ingen ændring',
    vsLastMonth: 'vs. sidste måned',
    firstMonthNote: 'Dette er den første måned med registrerede data. Ingen sammenligning med forrige måned er endnu tilgængelig.',
    standoutResult: 'Det fremragende resultat denne måned var',
    whichReached: 'som nåede',
    upFrom: 'steg med',
    fromLastMonth: 'sammenlignet med sidste måned',
    engagementRate: 'Din engagementsrate er',
    strongEngagement: '— dit publikum reagerer aktivt på dit indhold.',
    solidBaseline: '— et solidt udgangspunkt med plads til vækst.',
    lowEngagement: '— overvej at eksperimentere med forskellige indholdsformater for at fremme mere interaktion.',
    gained: 'Du fik',
    newFollowers: 'nye følgere denne måned, hvilket bringer dit samlede antal til',
    heldSteady: 'Dit antal følgere forblev stabilt på',
    postPublished: 'Udgivet den',
    page: 'Side',
    performanceMetrics: 'Ydelsesmålinger',
    firstMonthTracked: 'Dette er din første sporingsmåned for denne platform — ingen sammenligningsdata.',
    noPreviousData: 'Ingen data fra forrige måned at sammenligne med.',
    firstReportingMonth: 'Dette er din første rapporteringsmåned — vi sporer fremskridt herfra.',
    overallPerformance: 'Samlet ydeevne på tværs af alle platforme med statusindikator',
    serviceRecommendation: 'Serviceanbefaling baseret på dine resultater',
    comparison: 'Sammenligning',
    feature: 'FUNKTION',
    optionA: 'MULIGHED A',
    optionB: 'MULIGHED B',
    interestedCall: 'Interesseret? Svar på denne e-mail eller ring til os på',
  }
};

// ══════════════════════════════════════════════════════════════
// SECTION TITLE CONSTANTS — kept for internal reference, overridden by T
// ══════════════════════════════════════════════════════════════
const SECTION_TITLES = {
  performanceReport: "Performance Report",
  tableOfContents: "Table of Contents",
  monthlySummary: "Monthly Summary",
  keyWins: "Key Wins This Month",
  worthWatching: "Worth Watching",
  whatThisMeans: "What This Means for You",
  comparison: "Month-on-Month Comparison",
  topContent: "Top Performing Content",
  noteFromAgency: (orgName: string) => `A Note from ${orgName}`,
  thankYou: (firstName: string) => `Thank you, ${firstName}.`,
  preparedBy: (orgName: string, month: string) => `Prepared by ${orgName} | ${month}`,
  platformStatusOverview: "Platform Status Overview",
  noDataAvailable: "No data available for this period",
  preparedFor: "Prepared for",
  thisMonth: "This Month",
  lastMonth: "Last Month",
  change: "Change",
  interestedCTA: "Interested? Reply to this email or call us.",
  readyToGrow: "Ready to grow?",
} as const;

const MONTH_NAMES = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const PLATFORM_LABELS: Record<string, string> = {
  google_ads: "Google Ads", meta_ads: "Meta Ads", facebook: "Facebook",
  instagram: "Instagram", tiktok: "TikTok", linkedin: "LinkedIn",
  google_search_console: "Google Search Console", google_analytics: "Google Analytics",
  google_business_profile: "Google Business Profile", youtube: "YouTube", pinterest: "Pinterest"
};

const PLATFORM_DESCRIPTIONS: Record<string, string> = {
  google_ads: "your paid advertising on Google, showing how many people saw your ads, how much it cost, and what actions they took.",
  meta_ads: "your paid advertising on Meta (Facebook & Instagram), covering ad reach, spend, and the results they generated.",
  facebook: "your organic Facebook presence — how many people see your posts, engage with your content, and follow your page.",
  instagram: "your organic Instagram activity — follower growth, post engagement, and how people interact with your profile.",
  tiktok: "your TikTok presence — video views, follower growth, and how your short-form content performs.",
  linkedin: "your LinkedIn company page — professional audience growth, post engagement, and business networking reach.",
  google_search_console: "how your website appears in Google search results — what people search to find you and how often they click.",
  google_analytics: "your website traffic — how many people visit, where they come from, and what they do on your site.",
  google_business_profile: "your Google Business listing — how people find your business on Google Maps and Search, and the actions they take.",
  youtube: "your YouTube channel — video views, subscriber growth, and how long people watch your content.",
  pinterest: "your Pinterest presence — how your pins perform, how many people save them, and the traffic they drive."
};

// ══════════════════════════════════════════════════════════════
// METRIC LABELS — only metrics with a label here appear in PDF
// ══════════════════════════════════════════════════════════════
const METRIC_LABELS: Record<string, string> = {
  spend: "Spend", impressions: "Impressions", clicks: "Clicks",
  ctr: "CTR", conversions: "Conversions", cpc: "CPC", cpm: "CPM",
  reach: "Reach", total_followers: "Followers", follower_growth: "Growth",
  engagement: "Engagement", engagement_rate: "Eng. Rate",
  likes: "Likes", comments: "Comments", shares: "Shares",
  video_views: "Video Views", posts_published: "Posts",
  cost_per_conversion: "Cost/Conv", conversion_rate: "Conv. Rate",
  leads: "Leads", saves: "Saves", profile_visits: "Profile Visits",
  page_likes: "Page Likes", page_views: "Page Views", link_clicks: "Link Clicks",
  audience_growth_rate: "Audience Growth", search_clicks: "Search Clicks",
  search_impressions: "Search Impressions", search_ctr: "Search CTR",
  search_position: "Avg. Position", sessions: "Sessions",
  active_users: "Active Users", new_users: "New Users",
  ga_page_views: "Page Views", bounce_rate: "Bounce Rate",
  avg_session_duration: "Avg. Session Duration", pages_per_session: "Pages/Session",
  gbp_views: "Profile Views", gbp_searches: "Search Appearances",
  gbp_calls: "Phone Calls", gbp_direction_requests: "Direction Requests",
  gbp_website_clicks: "Website Clicks", gbp_reviews_count: "Reviews",
  gbp_average_rating: "Avg. Rating", subscribers: "Subscribers",
  views: "Views", watch_time: "Watch Time (min)", videos_published: "Videos Published",
  avg_view_duration: "Avg. View Duration", reactions: "Reactions",
  frequency: "Frequency", paid_impressions: "Paid Impressions",
  organic_clicks: "Organic Clicks", conversions_value: "Conv. Value",
  cost_per_lead: "Cost/Lead", search_impression_share: "Search Imp. Share",
  follower_removes: "Unfollows", pin_clicks: "Pin Clicks",
  outbound_clicks: "Outbound Clicks", total_pins: "Total Pins",
  total_boards: "Total Boards", roas: "ROAS",
  reel_count: "Reels Published", image_count: "Images Published",
  carousel_count: "Carousels Published", website_clicks: "Website Clicks",
  email_contacts: "Email Taps", media_count: "Total Posts",
  profile_views: "Profile Views", bio_link_clicks: "Bio Link Clicks",
  total_video_count: "Total Videos", total_likes_received: "Total Likes Received",
  following: "Following", completion_rate: "Completion Rate",
  average_time_watched: "Avg. Watch Time (s)", new_followers: "New Followers",
  cta_clicks: "CTA Clicks", engaged_users: "Engaged Users",
  paid_reach: "Paid Reach", paid_video_views: "Paid Video Views",
  total_impressions: "Total Impressions", total_video_views: "Total Video Views"
};

/** Platform-specific metrics order — max 12 shown in grid */
const PLATFORM_AVAILABLE_METRICS: Record<string, string[]> = {
  google_ads: ["spend", "impressions", "clicks", "ctr", "conversions", "conversions_value", "conversion_rate", "cpc", "cpm", "cost_per_conversion", "roas", "reach"],
  meta_ads: ["spend", "impressions", "reach", "clicks", "link_clicks", "ctr", "leads", "cpc", "cpm", "cost_per_lead", "frequency"],
  facebook: ["views", "reach", "engagement", "engagement_rate", "reactions", "comments", "shares", "total_followers", "follower_growth", "posts_published"],
  instagram: ["total_followers", "follower_growth", "profile_visits", "reach", "engagement", "engagement_rate", "likes", "comments", "shares", "saves", "posts_published", "video_views"],
  tiktok: ["total_followers", "follower_growth", "video_views", "profile_visits", "likes", "comments", "shares", "engagement_rate", "total_likes_received", "total_video_count"],
  linkedin: ["total_followers", "follower_growth", "impressions", "engagement", "engagement_rate", "likes", "comments", "shares", "clicks", "posts_published"],
  google_search_console: ["search_clicks", "search_impressions", "search_ctr", "search_position"],
  google_analytics: ["sessions", "active_users", "new_users", "ga_page_views", "bounce_rate", "avg_session_duration", "pages_per_session"],
  google_business_profile: ["gbp_views", "gbp_searches", "gbp_calls", "gbp_direction_requests", "gbp_website_clicks", "gbp_reviews_count", "gbp_average_rating"],
  youtube: ["subscribers", "views", "watch_time", "videos_published", "avg_view_duration"],
  pinterest: ["impressions", "saves", "pin_clicks", "outbound_clicks", "engagement", "engagement_rate", "total_followers", "total_pins", "total_boards"]
};

/** Key metrics per platform for traffic light and summary generation */
const PLATFORM_KEY_METRICS: Record<string, string[]> = {
  google_ads: ["conversions", "cpc", "ctr", "roas", "spend"],
  meta_ads: ["leads", "cpc", "ctr", "reach", "spend"],
  facebook: ["reach", "engagement", "engagement_rate", "follower_growth"],
  instagram: ["reach", "engagement", "engagement_rate", "follower_growth", "profile_visits"],
  tiktok: ["video_views", "engagement_rate", "follower_growth", "likes"],
  linkedin: ["impressions", "engagement", "engagement_rate", "follower_growth"],
  google_search_console: ["search_clicks", "search_impressions", "search_ctr", "search_position"],
  google_analytics: ["sessions", "active_users", "bounce_rate", "avg_session_duration"],
  google_business_profile: ["gbp_views", "gbp_searches", "gbp_calls", "gbp_website_clicks"],
  youtube: ["views", "subscribers", "watch_time", "avg_view_duration"],
  pinterest: ["impressions", "saves", "pin_clicks", "outbound_clicks"]
};

/** Metrics where a decrease is positive */
const INVERTED_METRICS = new Set(["bounce_rate", "cpc", "cpm", "cost_per_conversion", "cost_per_lead", "search_position", "avg_position"]);

/** Metrics that should always be shown even if zero */
const ALWAYS_SHOW_METRICS = new Set(["spend", "total_followers", "followers", "posts_published", "videos_published"]);

/** Hidden internal metrics */
const HIDDEN_METRICS = new Set(["campaign_count", "pages_count", "unfollows", "post_views", "post_clicks"]);

/** Platforms that get max 1 page */
const ONE_PAGE_PLATFORMS = new Set(["google_search_console", "google_business_profile", "youtube"]);

// ══════════════════════════════════════════════════════════════
// FIX 1 — ASCII-SAFE CHANGE INDICATORS (no Unicode arrows)
// ══════════════════════════════════════════════════════════════
function formatChangeIndicator(change: number | null, isInverted = false): { symbol: string; label: string; isPositive: boolean | null } {
  if (change === null || change === undefined || isNaN(change)) {
    return { symbol: '-', label: 'No change', isPositive: null };
  }
  if (Math.abs(change) < 0.1) {
    return { symbol: '-', label: '0.0%', isPositive: null };
  }
  const isGood = isInverted ? change < 0 : change > 0;
  const symbol = change > 0 ? '+' : '-';
  const label = `${symbol}${Math.abs(change).toFixed(1)}%`;
  return { symbol, label, isPositive: isGood };
}

// ══════════════════════════════════════════════════════════════
// COLOUR HELPERS
// ══════════════════════════════════════════════════════════════
const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
};

const rgbToHex = (rgb: [number, number, number]): string => {
  return `#${rgb.map(c => c.toString(16).padStart(2, "0")).join("")}`;
};

const hslToHex = (hsl: string): string => {
  const parts = hsl.trim().split(/[\s,]+/);
  const h = parseFloat(parts[0]) / 360;
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) { r = g = b = l; } else {
    const q2 = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p2 = 2 * l - q2;
    r = hue2rgb(p2, q2, h + 1/3);
    g = hue2rgb(p2, q2, h);
    b = hue2rgb(p2, q2, h - 1/3);
  }
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const parseColorToRgb = (color: string | null, fallback: [number, number, number]): [number, number, number] => {
  if (!color) return fallback;
  if (color.startsWith("#")) return hexToRgb(color);
  try { return hexToRgb(hslToHex(color)); } catch { return fallback; }
};

const lighten = (rgb: [number, number, number], amount: number): [number, number, number] => [
  Math.round(rgb[0] + (255 - rgb[0]) * amount),
  Math.round(rgb[1] + (255 - rgb[1]) * amount),
  Math.round(rgb[2] + (255 - rgb[2]) * amount),
];

const DEFAULTS = {
  offWhite: [248, 248, 248] as [number, number, number],
  cardBg: [255, 255, 255] as [number, number, number],
  black: [26, 26, 26] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  grey: [120, 120, 120] as [number, number, number],
  lightGrey: [220, 220, 220] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
  amber: [217, 119, 6] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  summaryBg: [240, 247, 255] as [number, number, number],
  summaryBorder: [83, 155, 219] as [number, number, number],
  coverDark: [26, 26, 26] as [number, number, number],
  coverDarkPanel: [36, 36, 36] as [number, number, number],
  tableAltRow: [250, 250, 250] as [number, number, number],
  statusStrongBg: [220, 252, 231] as [number, number, number],
  statusStrongText: [21, 128, 61] as [number, number, number],
  statusStrongBorder: [134, 239, 172] as [number, number, number],
  statusSteadyBg: [254, 249, 195] as [number, number, number],
  statusSteadyText: [133, 77, 14] as [number, number, number],
  statusSteadyBorder: [253, 224, 71] as [number, number, number],
  statusNeedsBg: [254, 226, 226] as [number, number, number],
  statusNeedsText: [153, 27, 27] as [number, number, number],
  statusNeedsBorder: [252, 165, 165] as [number, number, number],
  cardBorder: [229, 231, 235] as [number, number, number],
  metricLabel: [156, 163, 175] as [number, number, number],
  metricValue: [17, 24, 39] as [number, number, number],
  sectionLabel: [156, 163, 175] as [number, number, number],
  sectionDivider: [243, 244, 246] as [number, number, number]
};

interface PlatformData {
  platform: string;
  label: string;
  description: string;
  metrics: Record<string, number>;
  prevMetrics: Record<string, number>;
  enabledMetrics: string[];
  topContent: unknown[];
  hasPrevSnapshot: boolean;
  hasData: boolean;
}

function formatMetricValueFn(key: string, val: number, currSymbol: string): string {
  if (["spend", "cpc", "cost_per_conversion", "cost_per_lead", "conversions_value"].includes(key))
    return `${currSymbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (["ctr", "engagement_rate", "conversion_rate", "audience_growth_rate", "search_ctr", "bounce_rate", "search_impression_share", "completion_rate"].includes(key))
    return `${val.toFixed(2)}%`;
  if (["search_position", "gbp_average_rating"].includes(key)) return val.toFixed(1);
  if (["cpm"].includes(key)) return `${currSymbol}${val.toFixed(2)}`;
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
  return val % 1 !== 0 ? val.toFixed(2) : val.toLocaleString();
}

function calcChange(curr: number, prev: number): { pct: number; abs: number; dir: string } {
  if (prev === 0) return { pct: 0, abs: curr, dir: curr === 0 ? "flat" : "new" };
  const pct = ((curr - prev) / prev) * 100;
  return { pct, abs: curr - prev, dir: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}

function generatePlatformSummary(platform: string, metrics: Record<string, number>, prevMetrics: Record<string, number> | null, currSymbol: string): string {
  const lines: string[] = [];
  const platformLabel = PLATFORM_LABELS[platform] ?? platform;
  const isFirstMonth = !prevMetrics || Object.keys(prevMetrics).length === 0;
  const keyMetrics = PLATFORM_KEY_METRICS[platform] ?? [];

  if (isFirstMonth) {
    lines.push(`This is the first month of data for ${platformLabel}.`);
    lines.push(`No previous month comparison is available yet — next month's report will show your first month-on-month trends.`);
    return lines.join(" ");
  }

  let bestMetric = "";
  let bestChange = 0;
  for (const key of keyMetrics) {
    if (HIDDEN_METRICS.has(key)) continue;
    const curr = metrics[key];
    const prev = prevMetrics[key];
    if (curr === undefined || prev === undefined || prev === 0) continue;
    const change = ((curr - prev) / prev) * 100;
    const effective = INVERTED_METRICS.has(key) ? -change : change;
    if (effective > bestChange) {
      bestChange = effective;
      bestMetric = key;
    }
  }

  let worstMetric = "";
  let worstChange = 0;
  for (const key of keyMetrics) {
    if (HIDDEN_METRICS.has(key)) continue;
    const curr = metrics[key];
    const prev = prevMetrics[key];
    if (curr === undefined || prev === undefined || prev === 0) continue;
    const change = ((curr - prev) / prev) * 100;
    const effective = INVERTED_METRICS.has(key) ? -change : change;
    if (effective < worstChange) {
      worstChange = effective;
      worstMetric = key;
    }
  }

  if (bestMetric) {
    const label = METRIC_LABELS[bestMetric] ?? bestMetric;
    const val = formatMetricValueFn(bestMetric, metrics[bestMetric], currSymbol);
    const rawChange = ((metrics[bestMetric] - (prevMetrics[bestMetric] ?? 0)) / (prevMetrics[bestMetric] || 1)) * 100;
    const direction = INVERTED_METRICS.has(bestMetric)
      ? (rawChange < 0 ? `improved ${Math.abs(Math.round(rawChange))}%` : `up ${Math.round(rawChange)}%`)
      : `up ${Math.round(Math.abs(rawChange))}%`;
    lines.push(`The standout result this month was ${label}, which reached ${val} — ${direction} from last month.`);
  }

  if (worstMetric && Math.abs(worstChange) > 10) {
    const label = METRIC_LABELS[worstMetric] ?? worstMetric;
    const rawChange = ((metrics[worstMetric] - (prevMetrics[worstMetric] ?? 0)) / (prevMetrics[worstMetric] || 1)) * 100;
    lines.push(`${label} moved ${Math.abs(Math.round(rawChange))}% compared to last month — worth keeping an eye on.`);
  }

  if (metrics.engagement_rate !== undefined) {
    const rate = metrics.engagement_rate;
    if (rate > 3) lines.push(`Your engagement rate of ${rate.toFixed(1)}% is strong — your audience is actively responding to your content.`);
    else if (rate > 1) lines.push(`Your engagement rate is ${rate.toFixed(1)}% — a solid baseline, with room to grow through more interactive content.`);
    else lines.push(`Engagement rate is at ${rate.toFixed(1)}% — consider experimenting with different content formats to encourage more interaction.`);
  }

  if (metrics.follower_growth !== undefined && metrics.total_followers !== undefined) {
    if (metrics.follower_growth > 0) {
      lines.push(`You gained ${metrics.follower_growth.toLocaleString()} new followers this month, bringing your total to ${formatMetricValueFn("total_followers", metrics.total_followers, currSymbol)}.`);
    } else if (metrics.follower_growth === 0) {
      lines.push(`Your follower count held steady at ${formatMetricValueFn("total_followers", metrics.total_followers, currSymbol)}.`);
    }
  }

  if (lines.length === 0) {
    lines.push(`${platformLabel} performance was steady this month with no major changes.`);
  }

  return lines.join(" ");
}

function getPlatformStatus(platform: string, metrics: Record<string, number>, prevMetrics: Record<string, number> | null): "Strong" | "Steady" | "Needs Attention" {
  if (!prevMetrics || Object.keys(prevMetrics).length === 0) return "Steady";
  const keyMetrics = PLATFORM_KEY_METRICS[platform] ?? [];
  let positiveCount = 0;
  let negativeCount = 0;

  for (const key of keyMetrics) {
    const curr = metrics[key];
    const prev = prevMetrics[key];
    if (curr === undefined || prev === undefined || prev === 0) continue;
    const change = (curr - prev) / prev;
    const isInverted = INVERTED_METRICS.has(key);
    if (isInverted ? change < -0.05 : change > 0.05) positiveCount++;
    if (isInverted ? change > 0.05 : change < -0.05) negativeCount++;
  }

  if (positiveCount >= negativeCount + 2) return "Strong";
  if (negativeCount >= positiveCount + 2) return "Needs Attention";
  return "Steady";
}

function getKeyWins(allPlatformData: PlatformData[], currSymbol: string): string[] {
  const wins: { platform: string; metric: string; change: number; value: string }[] = [];
  const seenPlatforms = new Set<string>();

  for (const { platform, metrics, prevMetrics } of allPlatformData) {
    if (seenPlatforms.has(platform)) continue;
    const keyMetrics = PLATFORM_KEY_METRICS[platform] ?? [];
    let bestKey = "";
    let bestChange = 0;
    for (const key of keyMetrics) {
      if (HIDDEN_METRICS.has(key) || !METRIC_LABELS[key]) continue;
      const curr = metrics[key];
      const prev = prevMetrics?.[key];
      if (!curr || !prev || prev === 0) continue;
      const rawChange = ((curr - prev) / prev) * 100;
      const effective = INVERTED_METRICS.has(key) ? -rawChange : rawChange;
      if (effective > bestChange && effective > 10) {
        bestChange = effective;
        bestKey = key;
      }
    }
    if (bestKey) {
      seenPlatforms.add(platform);
      wins.push({
        platform: PLATFORM_LABELS[platform] ?? platform,
        metric: METRIC_LABELS[bestKey]!,
        change: bestChange,
        value: formatMetricValueFn(bestKey, metrics[bestKey], currSymbol),
      });
    }
  }

  return wins
    .sort((a, b) => b.change - a.change)
    .slice(0, 5)
    .map(w => `${w.platform}: ${w.metric} reached ${w.value} — up ${Math.round(w.change)}% from last month`);
}

function getWorthWatching(allPlatformData: PlatformData[]): string[] {
  const items: { text: string; pct: number }[] = [];
  const seenPlatforms = new Set<string>();

  for (const { platform, metrics, prevMetrics, label } of allPlatformData) {
    if (seenPlatforms.has(platform)) continue;
    const keyMetrics = PLATFORM_KEY_METRICS[platform] ?? [];
    let worstKey = "";
    let worstEffective = 0;
    for (const key of keyMetrics) {
      if (HIDDEN_METRICS.has(key) || !METRIC_LABELS[key]) continue;
      const curr = metrics[key];
      const prev = prevMetrics?.[key];
      if (curr === undefined || !prev || prev === 0) continue;
      const rawChange = ((curr - prev) / prev) * 100;
      const effective = INVERTED_METRICS.has(key) ? -rawChange : rawChange;
      if (effective < worstEffective && effective < -5) {
        worstEffective = effective;
        worstKey = key;
      }
    }
    if (worstKey) {
      seenPlatforms.add(platform);
      const rawChange = ((metrics[worstKey] - (prevMetrics?.[worstKey] ?? 0)) / (prevMetrics?.[worstKey] || 1)) * 100;
      const direction = rawChange < 0 ? "decreased" : "increased";
      const pctStr = Math.abs(rawChange) >= 100 ? Math.round(Math.abs(rawChange)).toLocaleString() : Math.abs(rawChange).toFixed(1);
      items.push({
        text: `${label}: ${METRIC_LABELS[worstKey]} ${direction} ${pctStr}% — worth monitoring next month`,
        pct: Math.abs(worstEffective),
      });
    }
  }

  return items.sort((a, b) => b.pct - a.pct).slice(0, 3).map(i => i.text);
}

function cleanMetricsForDisplay(platform: string, metrics: Record<string, number>, prevMetrics: Record<string, number> | null): string[] {
  const allowed = PLATFORM_AVAILABLE_METRICS[platform] ?? [];
  const result: string[] = [];

  for (const key of allowed) {
    if (HIDDEN_METRICS.has(key)) continue;
    const val = metrics[key];
    if (val === undefined || val === null) continue;
    if (!ALWAYS_SHOW_METRICS.has(key) && val === 0 && (!prevMetrics || !prevMetrics[key] || prevMetrics[key] === 0)) continue;
    const label = METRIC_LABELS[key];
    if (!label) continue;
    result.push(key);
  }

  return result.slice(0, 12);
}

function getPostCaption(item: Record<string, unknown>): string {
  let caption = String(item.message || item.caption || item.text || item.title || item.name || item.campaign_name || "").trim();
  if (!caption || caption === "—" || caption === "undefined" || caption === "null") {
    const postDate = item.created_time || item.date || item.published_at || item.timestamp || "";
    caption = postDate ? `Post published on ${String(postDate).substring(0, 10)}` : "Post published this month";
  }
  // Remove newlines — they cause layout breaks in jsPDF
  caption = caption.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (caption.length > 65) caption = caption.substring(0, 62) + "...";
  return caption;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

    console.log(JSON.stringify({ ts: new Date().toISOString(), fn: "generate-report", method: req.method, connection_id: null }));

  let earlyReportId: string | undefined;
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── Mandatory auth verification ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub;

    const { client_id, report_month, report_year, date_from, date_to } = (await req.json()) as ReportRequest;
    const isCustomRange = !!(date_from && date_to);

    if (!client_id || !report_month || !report_year) {
      return new Response(JSON.stringify({ error: "Missing client_id, report_month, or report_year" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if a report is already being generated for this client/period
    let existingRunningQuery = supabase.from("reports")
      .select("id, status")
      .eq("client_id", client_id)
      .eq("status", "running");

    if (isCustomRange) {
      existingRunningQuery = existingRunningQuery.eq("date_from", date_from).eq("date_to", date_to);
    } else {
      existingRunningQuery = existingRunningQuery.eq("report_month", report_month).eq("report_year", report_year);
    }

    const { data: existingRunning } = await existingRunningQuery.maybeSingle();

    if (existingRunning) {
      return new Response(JSON.stringify({ error: "Report is already being generated for this period" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Compute month/year pairs for snapshot fetching ──
    // For custom ranges, compute all months that overlap the range
    // For monthly reports, just use the single month
    interface MonthYear { month: number; year: number }
    const currentMonths: MonthYear[] = [];
    const prevMonths: MonthYear[] = [];

    if (isCustomRange) {
      const fromDate = new Date(date_from + "T00:00:00Z");
      const toDate = new Date(date_to + "T00:00:00Z");
      let m = fromDate.getMonth() + 1;
      let yr = fromDate.getFullYear();
      const endM = toDate.getMonth() + 1;
      const endY = toDate.getFullYear();

      while (yr < endY || (yr === endY && m <= endM)) {
        currentMonths.push({ month: m, year: yr });
        m++;
        if (m > 12) { m = 1; yr++; }
      }

      // Previous period: same number of months immediately before
      const periodLength = currentMonths.length;
      const firstMonth = currentMonths[0];
      let pm = firstMonth.month;
      let py = firstMonth.year;
      for (let i = 0; i < periodLength; i++) {
        pm--;
        if (pm < 1) { pm = 12; py--; }
        prevMonths.unshift({ month: pm, year: py });
      }
    } else {
      currentMonths.push({ month: report_month, year: report_year });
      const pm = report_month === 1 ? 12 : report_month - 1;
      const py = report_month === 1 ? report_year - 1 : report_year;
      prevMonths.push({ month: pm, year: py });
    }

    // Build snapshot queries using OR filters for multi-month
    const buildSnapshotQuery = (months: MonthYear[]) => {
      if (months.length === 1) {
        return supabase.from("monthly_snapshots").select("*")
          .eq("client_id", client_id)
          .eq("report_month", months[0].month)
          .eq("report_year", months[0].year);
      }
      // For multiple months, use .or() filter
      const orClauses = months.map(m => `and(report_month.eq.${m.month},report_year.eq.${m.year})`).join(",");
      return supabase.from("monthly_snapshots").select("*")
        .eq("client_id", client_id)
        .or(orClauses);
    };

    const [clientRes, snapshotsRes, configRes, prevSnapshotsRes, metricDefaultsRes] = await Promise.all([
      supabase.from("clients").select("*").eq("id", client_id).single(),
      buildSnapshotQuery(currentMonths),
      supabase.from("client_platform_config").select("*").eq("client_id", client_id).eq("is_enabled", true),
      buildSnapshotQuery(prevMonths),
      supabase.from("metric_defaults").select("*"),
    ]);

    const client = clientRes.data;
    if (!client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller belongs to the org that owns this client
    const { data: membership } = await supabase.from("org_members").select("id").eq("user_id", callerId).eq("org_id", client.org_id).limit(1).single();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Upsert report record with "running" status immediately
    let earlyReportQuery;
    if (isCustomRange) {
      // For custom range, find existing by date range or insert new
      const { data: existingReport } = await supabase.from("reports")
        .select("id")
        .eq("client_id", client_id)
        .eq("date_from", date_from)
        .eq("date_to", date_to)
        .maybeSingle();

      if (existingReport) {
        earlyReportQuery = await supabase.from("reports")
          .update({ status: "running" as const, generated_at: null, pdf_storage_path: null })
          .eq("id", existingReport.id)
          .select("id")
          .single();
      } else {
        earlyReportQuery = await supabase.from("reports")
          .insert({
            client_id,
            report_month,
            report_year,
            org_id: client.org_id,
            status: "running" as const,
            date_from,
            date_to,
          })
          .select("id")
          .single();
      }
    } else {
      earlyReportQuery = await supabase.from("reports")
        .upsert({
          client_id,
          report_month,
          report_year,
          org_id: client.org_id,
          status: "running" as const,
          generated_at: null,
          pdf_storage_path: null,
        }, { onConflict: "client_id,report_month,report_year", ignoreDuplicates: false })
        .select("id")
        .single();
    }

    earlyReportId = earlyReportQuery?.data?.id;

    const { data: org } = await supabase.from("organisations").select("*").eq("id", client.org_id).single();

    // Fetch share token and custom domain for dashboard links in the PDF
    const [shareTokenRes, customDomainRes] = await Promise.all([
      supabase.from("client_share_tokens").select("token").eq("client_id", client_id).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("custom_domains").select("domain").eq("org_id", client.org_id).eq("is_active", true).not("verified_at", "is", null).limit(1).maybeSingle(),
    ]);
    const shareToken = (shareTokenRes.data as { token: string } | null)?.token ?? null;
    const portalDomain = (customDomainRes.data as { domain: string } | null)?.domain ?? "amw-reports.lovable.app";
    const dashboardUrl: string | null = shareToken ? `https://${portalDomain}/portal/${shareToken}` : null;

    const orgName = org?.name ?? "Your Agency";
    const reportSettings = (org?.report_settings ?? {}) as Record<string, unknown>;
    const showLogo = reportSettings.show_logo !== false;
    const orgEmail = (reportSettings.email as string) || "";
    const orgWebsite = (reportSettings.website as string) || "";
    const orgPhone = (reportSettings.phone as string) || "";

    // PDF uses org primary_color directly — no separate override
    const primaryColor = parseColorToRgb(org?.primary_color, [179, 47, 191]);
    const secondaryColor = parseColorToRgb(org?.secondary_color, [83, 155, 219]);
    const accentColor = parseColorToRgb(org?.accent_color, [78, 214, 142]);
    const primaryHex = rgbToHex(primaryColor);

    // Chart colours — use org chart palette if set, otherwise derive
    const chart1 = parseColorToRgb(org?.chart_color_1 ?? org?.primary_color, [179, 47, 191]);
    const chart2 = parseColorToRgb(org?.chart_color_2 ?? org?.secondary_color, [83, 155, 219]);
    const chart3 = parseColorToRgb(org?.chart_color_3 ?? org?.accent_color, [78, 214, 142]);
    const chart4 = parseColorToRgb(org?.chart_color_4, [238, 135, 51]);

    const C = {
      offWhite: DEFAULTS.offWhite,
      cardBg: [255, 255, 255] as [number, number, number],
      black: DEFAULTS.black,
      primary: primaryColor,
      primaryLight: lighten(primaryColor, 0.85),
      primaryMid: lighten(primaryColor, 0.7),
      secondary: secondaryColor,
      secondaryLight: lighten(secondaryColor, 0.88),
      accent: accentColor,
      accentLight: lighten(accentColor, 0.88),
      // Chart colours (same as dashboard)
      charts: [chart1, chart2, chart3, chart4],
      // Semantic — FIXED, never overridden by branding
      green: DEFAULTS.green,
      greenLight: lighten(DEFAULTS.green, 0.88),
      amber: DEFAULTS.amber,
      amberLight: lighten(DEFAULTS.amber, 0.88),
      red: DEFAULTS.red,
      redLight: lighten(DEFAULTS.red, 0.88),
      white: DEFAULTS.white,
      grey: DEFAULTS.grey,
      lightGrey: DEFAULTS.lightGrey,
      summaryBg: lighten(secondaryColor, 0.88),
      summaryBorder: secondaryColor,
      coverDark: DEFAULTS.coverDark,
      coverDarkPanel: DEFAULTS.coverDarkPanel,
      tableAltRow: DEFAULTS.tableAltRow,
      statusStrongBg: DEFAULTS.statusStrongBg,
      statusStrongText: DEFAULTS.statusStrongText,
      statusStrongBorder: DEFAULTS.statusStrongBorder,
      statusSteadyBg: DEFAULTS.statusSteadyBg,
      statusSteadyText: DEFAULTS.statusSteadyText,
      statusSteadyBorder: DEFAULTS.statusSteadyBorder,
      statusNeedsBg: DEFAULTS.statusNeedsBg,
      statusNeedsText: DEFAULTS.statusNeedsText,
      statusNeedsBorder: DEFAULTS.statusNeedsBorder,
      cardBorder: DEFAULTS.cardBorder,
      metricLabel: DEFAULTS.metricLabel,
      metricValue: DEFAULTS.metricValue,
      sectionLabel: DEFAULTS.sectionLabel,
      sectionDivider: DEFAULTS.sectionDivider,
      textFaint: [180, 180, 180] as [number, number, number],
    };

    const rawSnapshots = snapshotsRes.data ?? [];
    const rawPrevSnapshots = prevSnapshotsRes.data ?? [];
    const configs = configRes.data ?? [];

    // ── Aggregate multi-month snapshots per platform ──
    const RATE_METRICS = new Set(["ctr", "engagement_rate", "conversion_rate", "audience_growth_rate", "search_ctr", "bounce_rate", "search_impression_share", "completion_rate", "cpc", "cpm", "cost_per_conversion", "cost_per_lead", "avg_session_duration", "pages_per_session", "avg_view_duration", "average_time_watched", "frequency", "gbp_average_rating", "search_position", "roas"]);
    const CUMULATIVE_METRICS = new Set(["total_followers", "followers", "subscribers", "following", "total_pins", "total_boards", "total_video_count", "media_count"]);

    const aggregateSnapshots = (snaps: typeof rawSnapshots): { platform: string; metrics_data: Record<string, number>; top_content: unknown[] }[] => {
      const byPlatform = new Map<string, typeof rawSnapshots>();
      for (const s of snaps) {
        const p = s.platform as string;
        if (!byPlatform.has(p)) byPlatform.set(p, []);
        byPlatform.get(p)!.push(s);
      }

      const results: { platform: string; metrics_data: Record<string, number>; top_content: unknown[] }[] = [];
      for (const [platform, platSnaps] of byPlatform) {
        if (platSnaps.length === 1) {
          results.push({
            platform,
            metrics_data: platSnaps[0].metrics_data as Record<string, number>,
            top_content: Array.isArray(platSnaps[0].top_content) ? platSnaps[0].top_content : [],
          });
          continue;
        }

        // Sort by year/month ascending for cumulative logic (take latest)
        platSnaps.sort((a, b) => a.report_year !== b.report_year ? a.report_year - b.report_year : a.report_month - b.report_month);

        const aggregated: Record<string, number> = {};
        const weightKeys: Record<string, number> = {}; // for weighted averages

        for (const snap of platSnaps) {
          const md = snap.metrics_data as Record<string, number>;
          for (const [key, val] of Object.entries(md)) {
            if (typeof val !== "number") continue;
            if (CUMULATIVE_METRICS.has(key)) {
              // Take latest value
              aggregated[key] = val;
            } else if (RATE_METRICS.has(key)) {
              // Weighted average - weight by impressions or clicks
              const weight = md.impressions ?? md.clicks ?? md.sessions ?? 1;
              aggregated[key] = (aggregated[key] ?? 0) + val * weight;
              weightKeys[key] = (weightKeys[key] ?? 0) + weight;
            } else {
              // Additive
              aggregated[key] = (aggregated[key] ?? 0) + val;
            }
          }
        }

        // Finalize weighted averages
        for (const key of Object.keys(weightKeys)) {
          if (weightKeys[key] > 0) {
            aggregated[key] = aggregated[key] / weightKeys[key];
          }
        }

        // Merge top content from all months
        const allTopContent: unknown[] = [];
        for (const snap of platSnaps) {
          if (Array.isArray(snap.top_content)) allTopContent.push(...snap.top_content);
        }

        results.push({ platform, metrics_data: aggregated, top_content: allTopContent });
      }
      return results;
    };

    const snapshots = isCustomRange ? aggregateSnapshots(rawSnapshots) : rawSnapshots.map(s => ({
      platform: s.platform as string,
      metrics_data: s.metrics_data as Record<string, number>,
      top_content: Array.isArray(s.top_content) ? s.top_content : [],
    }));
    const prevSnapshots = isCustomRange ? aggregateSnapshots(rawPrevSnapshots) : rawPrevSnapshots.map(s => ({
      platform: s.platform as string,
      metrics_data: s.metrics_data as Record<string, number>,
      top_content: Array.isArray(s.top_content) ? s.top_content : [],
    }));

    const CURRENCY_SYMBOLS: Record<string, string> = {
      GBP: "\u00A3", EUR: "\u20AC", USD: "$", PLN: "zl", CAD: "C$", AUD: "A$", NZD: "NZ$",
      AED: "AED", BRL: "R$", CHF: "CHF", CZK: "Kc", DKK: "kr", HKD: "HK$",
      HUF: "Ft", IDR: "Rp", ILS: "ILS", INR: "INR", JPY: "JPY", KRW: "KRW", MXN: "MX$",
      MYR: "RM", NOK: "kr", PHP: "PHP", RON: "lei", SEK: "kr", SGD: "S$",
      THB: "THB", TRY: "TRY", TWD: "NT$", ZAR: "R",
    };
    const currSymbol = CURRENCY_SYMBOLS[client.preferred_currency ?? "GBP"] ?? "\u00A3";

    const detailLevel = (client.report_detail_level as string) ?? 'standard';
    const maxMetricCards = detailLevel === 'summary' ? 5 : detailLevel === 'detailed' ? 15 : 9;
    const maxTopPosts = detailLevel === 'summary' ? 0 : detailLevel === 'detailed' ? 5 : 3;
    const showComparisonTable = detailLevel !== 'summary';
    const maxTableRows = detailLevel === 'summary' ? 6 : 8;

    const reportLanguage = (client.report_language as string) ?? 'en';
    const T = TRANSLATIONS[reportLanguage] ?? TRANSLATIONS['en'];
    console.log('Report language:', reportLanguage);

    if (snapshots.length === 0) {
      return new Response(JSON.stringify({
        error: "No data snapshots found for this period. Please sync platform data before generating a report."
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build period label for PDF
    const periodLabel = isCustomRange
      ? `${date_from} to ${date_to}`
      : `${MONTH_NAMES[report_month]} ${report_year}`;

    // Comparison labels — use "Previous Period" for custom range
    const currentLabel = isCustomRange ? T.thisPeriod : T.thisMonth;
    const previousLabel = isCustomRange ? T.previousPeriod : T.lastMonth;

    const { data: upsellData } = await supabase.from("report_upsells")
      .select("*").eq("client_id", client_id).eq("report_month", report_month)
      .eq("report_year", report_year).eq("is_active", true).limit(1).maybeSingle();

    const platformSections: PlatformData[] = [];
    const noDataPlatforms: string[] = [];

    for (const snapshot of snapshots) {
      const config = configs.find((c: Record<string, unknown>) => c.platform === snapshot.platform);
      const metrics = snapshot.metrics_data as Record<string, number>;
      const prevSnapshot = prevSnapshots.find((s: { platform: string }) => s.platform === snapshot.platform);
      const prevMetrics = (prevSnapshot?.metrics_data ?? {}) as Record<string, number>;
      const hasPrevSnapshot = !!prevSnapshot;
      const topContent = Array.isArray(snapshot.top_content) ? snapshot.top_content : [];

      let enabledMetrics: string[];
      const metricDefaults = (metricDefaultsRes?.data ?? []) as { platform: string; default_metrics: string[] }[];
      if (config?.enabled_metrics?.length > 0) {
        const configMetrics = (config.enabled_metrics as string[]).filter((k: string) => METRIC_LABELS[k] && !HIDDEN_METRICS.has(k));
        enabledMetrics = configMetrics.filter(k => {
          if (ALWAYS_SHOW_METRICS.has(k)) return true;
          const curr = metrics[k] ?? 0;
          const prev = prevMetrics[k] ?? 0;
          return curr !== 0 || prev !== 0;
        }).slice(0, 12);
      } else {
        // Fall back to org-level metric defaults if available
        const platformDefault = metricDefaults.find(d => d.platform === snapshot.platform);
        if (platformDefault?.default_metrics?.length > 0) {
          const defaultMetrics = platformDefault.default_metrics.filter((k: string) => METRIC_LABELS[k] && !HIDDEN_METRICS.has(k));
          enabledMetrics = defaultMetrics.filter(k => {
            if (ALWAYS_SHOW_METRICS.has(k)) return true;
            const curr = metrics[k] ?? 0;
            const prev = prevMetrics[k] ?? 0;
            return curr !== 0 || prev !== 0;
          }).slice(0, 12);
        } else {
          enabledMetrics = cleanMetricsForDisplay(snapshot.platform as string, metrics, hasPrevSnapshot ? prevMetrics : null);
        }
      }

      const hasAnyData = enabledMetrics.some(k => (metrics[k] ?? 0) !== 0);

      if (!hasAnyData) {
        noDataPlatforms.push(PLATFORM_LABELS[snapshot.platform as string] ?? (snapshot.platform as string));
        continue;
      }

      platformSections.push({
        platform: snapshot.platform as string,
        label: PLATFORM_LABELS[snapshot.platform as string] ?? (snapshot.platform as string),
        description: PLATFORM_DESCRIPTIONS[snapshot.platform as string] ?? "performance data for this platform.",
        metrics,
        prevMetrics,
        enabledMetrics,
        topContent,
        hasPrevSnapshot,
        hasData: hasAnyData,
      });
    }

    const platformSummaries: Record<string, string> = {};
    for (const section of platformSections) {
      let summary = generatePlatformSummary(
        section.platform,
        section.metrics,
        section.hasPrevSnapshot ? section.prevMetrics : null,
        currSymbol
      );
      if (dashboardUrl) {
        summary += " See your full dashboard for detailed breakdowns and trends.";
      }
      platformSummaries[section.platform] = summary;
    }

    const keyWins = getKeyWins(platformSections, currSymbol);
    const worthWatching = getWorthWatching(platformSections);

    const executiveSummary = (() => {
      const lines: string[] = [];
      lines.push(`This report highlights ${client.company_name}'s key metrics for ${periodLabel}.`);
      if (dashboardUrl) {
        lines.push(`For real-time data, drill-downs, and historical trends, visit your dashboard.`);
      }
      if (keyWins.length > 0) {
        lines.push(`The highlight: ${keyWins[0]}.`);
      }
      const strongPlatforms = platformSections.filter(s => getPlatformStatus(s.platform, s.metrics, s.hasPrevSnapshot ? s.prevMetrics : null) === "Strong");
      if (strongPlatforms.length > 0) {
        const names = strongPlatforms.map(s => s.label).join(", ");
        lines.push(`${names} ${strongPlatforms.length === 1 ? "is" : "are"} performing strongly.`);
      }
      if (worthWatching.length > 0) {
        lines.push(`There are some areas worth monitoring — see the details below.`);
      }
      return lines.join(" ");
    })();

    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const W = 297, H = 210, M = 14;
    const CW = W - M * 2;

    const setC = (c: number[]) => doc.setTextColor(c[0], c[1], c[2]);
    const setF = (c: number[]) => doc.setFillColor(c[0], c[1], c[2]);
    const setD = (c: number[]) => doc.setDrawColor(c[0], c[1], c[2]);

    let pageCount = 0;
    const pageToc: { title: string; page: number }[] = [];

    const formatVal = (key: string, val: number) => formatMetricValueFn(key, val, currSymbol);

    const getChangeColor = (key: string, dir: string): number[] => {
      if (dir === "flat" || dir === "new") return C.grey;
      const isInverted = INVERTED_METRICS.has(key);
      if (dir === "up") return isInverted ? C.red : C.green;
      return isInverted ? C.green : C.red;
    };

    let logoBase64: string | null = null;
    let logoExt: "PNG" | "JPEG" = "PNG";
    if (showLogo && org?.logo_url) {
      try {
        const logoRes = await fetch(org.logo_url, {
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (logoRes.ok) {
          const contentType = logoRes.headers.get('content-type') ?? '';
          logoExt = contentType.includes('jpeg') || contentType.includes('jpg') ||
                    org.logo_url.toLowerCase().includes('.jpg') || org.logo_url.toLowerCase().includes('.jpeg') ? "JPEG" : "PNG";
          const logoBlob = await logoRes.arrayBuffer();
          const uint8 = new Uint8Array(logoBlob);
          // Convert to base64 in chunks to avoid stack overflow on large images
          let binary = '';
          const chunkSize = 8192;
          for (let i = 0; i < uint8.length; i += chunkSize) {
            binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
          }
          logoBase64 = btoa(binary);
          console.log(`Logo loaded: ${logoExt}, size: ${uint8.length} bytes`);
        } else {
          console.error(`Logo fetch failed: ${logoRes.status} ${logoRes.statusText} for ${org.logo_url}`);
        }
      } catch (err) {
        console.error(`Logo fetch exception:`, err instanceof Error ? err.message : err);
      }
    }

    const drawStatusBadge = (x: number, y: number, status: string, _w = 30) => {
      const colors: Record<string, { bg: number[]; text: number[] }> = {
        'Strong':          { bg: C.statusStrongBg, text: C.statusStrongText },
        'Steady':          { bg: C.statusSteadyBg, text: C.statusSteadyText },
        'Needs Attention': { bg: C.statusNeedsBg,  text: C.statusNeedsText },
      };
      const c = colors[status] ?? colors['Steady'];
      const label = status;
      doc.setFontSize(6.5);
      const textWidth = doc.getTextWidth(label);
      const padH = 2.5;
      const padV = 1.2;
      const badgeW = textWidth + padH * 2;
      const badgeH = 4.5;
      setF(c.bg); doc.roundedRect(x, y - badgeH + padV, badgeW, badgeH, 1, 1, 'F');
      setC(c.text); doc.setFont('helvetica', 'bold');
      doc.text(label, x + padH, y);
      setC(C.black); doc.setFont('helvetica', 'normal');
    };

    const drawSectionLabel = (label: string, yPos: number): number => {
      doc.setFontSize(7); setC(C.sectionLabel);
      doc.text(label.toUpperCase(), M, yPos);
      setD(C.sectionDivider); doc.setLineWidth(0.3);
      doc.line(M, yPos + 2, W - M, yPos + 2);
      return yPos + 6;
    };

    const addPageHeader = (sectionTitle: string, status?: string) => {
      setF(C.white); doc.rect(0, 0, W, 14, "F");
      setF(C.primary); doc.rect(0, 0, W, 1.5, "F");

      let headerX = M;
      if (logoBase64) {
        try {
          doc.addImage(`data:image/${logoExt.toLowerCase()};base64,${logoBase64}`, logoExt, M, 3, 18, 9);
          headerX = M + 22;
        } catch { }
      }

      doc.setFontSize(10); setC(C.primary);
      doc.text(sectionTitle, headerX, 9);

      if (status) {
        const titleW = doc.getTextWidth(sectionTitle);
        drawStatusBadge(headerX + titleW + 6, 8, status);
      }

      doc.setFontSize(6.5); setC(C.grey);
      doc.text(`${client.company_name} — ${periodLabel} | ${T.page} ${pageCount}`, W - M, 9, { align: "right" });

      // Brand colour line under header
      setF(C.primary); doc.rect(0, 14, W, 0.5, 'F');
    };

    const addPageFooter = () => {
      setD(C.lightGrey); doc.setLineWidth(0.3);
      doc.line(M, H - 10, W - M, H - 10);
      doc.setFontSize(6.5); setC(C.grey);
      doc.text(`${orgName} | ${T.confidential}`, M, H - 6);
      const footerRight = orgEmail || orgWebsite;
      if (footerRight) {
        doc.text(footerRight, W - M, H - 6, { align: "right" });
      }
    };

    const startNewPage = (sectionTitle?: string, status?: string): number => {
      if (pageCount > 0) doc.addPage();
      pageCount++;
      if (sectionTitle) {
        addPageHeader(sectionTitle, status);
      } else {
        setF(C.primary); doc.rect(0, 0, W, 1.5, "F");
      }
      addPageFooter();
      return sectionTitle ? 20 : M + 4;
    };

    const wrapText = (text: string, x: number, y: number, maxW: number, lh: number): number => {
      const lines = doc.splitTextToSize(text, maxW);
      for (const line of lines) {
        if (y > H - 16) { y = startNewPage(); }
        doc.text(line, x, y);
        y += lh;
      }
      return y;
    };

    pageCount++;
    console.log('Cover: C.primary =', C.primary, 'logoBase64 length =', logoBase64?.length ?? 0);

    // Cover — dark background full page
    setF(C.coverDark); doc.rect(0, 0, W, H, 'F');

    // Brand colour accent bar — top of page, full width, 4mm tall
    setF(C.primary); doc.rect(0, 0, W, 4, 'F');

    // Right panel — darker shade of brand primary
    const panelX = W * 0.62;
    const panelWidth = W - panelX;
    const darkerPrimary = C.primary.map((v: number) => Math.max(0, v - 30)) as [number, number, number];
    setF(darkerPrimary); doc.rect(panelX, 0, panelWidth, H, 'F');

    // Logo in top-left
    if (logoBase64) {
      try {
        doc.addImage(`data:image/${logoExt.toLowerCase()};base64,${logoBase64}`, logoExt, 14, 10, 50, 16, undefined, 'FAST');
      } catch (imgErr) {
        console.error('Logo addImage failed:', imgErr instanceof Error ? imgErr.message : imgErr);
        doc.setFontSize(12); setC(C.white); doc.setFont('helvetica', 'bold');
        doc.text(orgName, 14, 18);
        doc.setFont('helvetica', 'normal');
      }
    } else {
      doc.setFontSize(20); setC(C.white);
      doc.text(orgName, 14, 30);
    }

    // "PERFORMANCE REPORT" label
    doc.setFontSize(10); setC(C.grey);
    doc.text(T.performanceReport, 14, 50);

    // Company name — large white text
    doc.setFontSize(34); setC(C.white);
    const companyLines = doc.splitTextToSize(client.company_name, panelX - 30);
    let coverY = 68;
    for (const line of companyLines) {
      doc.text(line, 14, coverY);
      coverY += 14;
    }

    // Month/year in lighter brand colour
    coverY += 6;
    doc.setFontSize(14); setC(lighten(C.primary, 0.4));
    doc.text(periodLabel, 14, coverY);
    coverY += 12;

    // Prepared for
    doc.setFontSize(9); setC(C.grey);
    doc.text(`${T.preparedFor}: ${client.full_name}`, 14, coverY);
    coverY += 5;
    doc.text(`${T.preparedBy}: ${orgName}`, 14, coverY);

    // Hero KPIs on the right panel
    const allMetrics: Record<string, number> = {};
    for (const s of platformSections) {
      for (const [k, v] of Object.entries(s.metrics)) {
        if (typeof v === "number") allMetrics[k] = (allMetrics[k] ?? 0) + v;
      }
    }

    const heroMetricCandidates = [
      { key: "reach", label: "Total Reach" },
      { key: "impressions", label: "Impressions" },
      { key: "spend", label: "Total Spend" },
      { key: "total_followers", label: "Followers" },
      { key: "engagement", label: "Engagements" },
      { key: "clicks", label: "Clicks" },
      { key: "sessions", label: "Sessions" },
      { key: "views", label: "Views" },
      { key: "conversions", label: "Conversions" },
      { key: "leads", label: "Leads" },
    ];
    const heroMetrics = heroMetricCandidates
      .filter(h => (allMetrics[h.key] ?? 0) > 0)
      .sort((a, b) => Math.abs(allMetrics[b.key] ?? 0) - Math.abs(allMetrics[a.key] ?? 0))
      .slice(0, 3);

    const kpiStartY = H - 70;
    const kpiRightX = panelX + 16;
    const kpiW = panelWidth - 32;
    heroMetrics.forEach((hero, i) => {
      const ky = kpiStartY + i * 20;
      const isLast = i === heroMetrics.length - 1;
      doc.setFontSize(22); setC(C.white);
      doc.text(formatVal(hero.key, allMetrics[hero.key]), kpiRightX, ky + 6);
      doc.setFontSize(7); setC(C.grey);
      doc.text(hero.label.toUpperCase(), kpiRightX, ky + 12);
      if (!isLast) {
        setD([60, 60, 60]); doc.setLineWidth(0.3);
        doc.line(kpiRightX, ky + 16, kpiRightX + kpiW, ky + 16);
      }
    });

    // Cover footer
    doc.setFontSize(6.5); setC(C.grey);
    const coverFooterParts: string[] = [];
    if (orgEmail) coverFooterParts.push(orgEmail);
    if (orgWebsite) coverFooterParts.push(orgWebsite);
    if (coverFooterParts.length > 0) {
      doc.text(coverFooterParts.join(" | "), W / 2, H - 10, { align: "center" });
    }
    doc.text(`${orgName} | ${T.confidential}`, W / 2, H - 5, { align: "center" });

    let y = startNewPage(T.tableOfContents);
    y += 2;

    let prevPeriodLabel: string;
    if (isCustomRange) {
      prevPeriodLabel = T.previousPeriod;
    } else {
      const prevMonth = report_month === 1 ? 12 : report_month - 1;
      const prevYear = report_month === 1 ? report_year - 1 : report_year;
      prevPeriodLabel = `${MONTH_NAMES[prevMonth]} ${prevYear}`;
    }

    const reportCoversText = isCustomRange
      ? `${T.reportCovers} ${date_from} to ${date_to}. ${T.allFigures} ${prevPeriodLabel} ${T.unlessStated}.`
      : (() => {
          const daysInMonth = new Date(report_year, report_month, 0).getDate();
          return `${T.reportCovers} 1 ${MONTH_NAMES[report_month]} ${report_year} to ${daysInMonth} ${MONTH_NAMES[report_month]} ${report_year}. ${T.allFigures} ${prevPeriodLabel} ${T.unlessStated}.`;
        })();

    doc.setFontSize(9); setC(C.grey);
    y = wrapText(reportCoversText, M, y, CW, 5);
    y += 8;

    let tocIndex = 1;
    let estimatedPage = 3;

    for (const section of platformSections) {
      if (y + 16 > H - 16) { y = startNewPage(T.tableOfContents); }

      setF(C.offWhite); doc.roundedRect(M, y - 4, CW, 14, 2, 2, "F");
      const tocStatus = getPlatformStatus(section.platform, section.metrics, section.hasPrevSnapshot ? section.prevMetrics : null);
      const tocBorderColor = tocStatus === "Strong" ? C.statusStrongText : tocStatus === "Needs Attention" ? C.statusNeedsText : C.statusSteadyText;
      setF(tocBorderColor); doc.rect(M, y - 4, 3, 14, "F");

      doc.setFontSize(14); setC(C.primary);
      doc.text(String(tocIndex).padStart(2, "0"), M + 6, y + 4);

      doc.setFontSize(10); setC(C.black);
      doc.text(section.label, M + 20, y + 1);

      doc.setFontSize(7); setC(C.grey);
      const desc = PLATFORM_DESCRIPTIONS[section.platform] ?? "Performance metrics and analysis";
      const truncDesc = desc.length > 90 ? desc.substring(0, 87) + "..." : desc;
      doc.text(truncDesc, M + 20, y + 7);

      drawStatusBadge(W - M - 52, y, tocStatus, 28);

      doc.setFontSize(8); setC(C.grey);
      doc.text(`p.${estimatedPage}`, W - M - 6, y + 1, { align: "right" });

      y += 18;
      tocIndex++;
      estimatedPage += ONE_PAGE_PLATFORMS.has(section.platform) ? 1 : 2;
    }

    for (const label of noDataPlatforms) {
      if (y + 12 > H - 16) { y = startNewPage(T.tableOfContents); }
      setF(C.offWhite); doc.roundedRect(M, y - 4, CW, 10, 2, 2, "F");
      setF(C.lightGrey); doc.rect(M, y - 4, 3, 10, "F");
      doc.setFontSize(9); setC(C.grey);
      doc.text(`${label} — ${T.noDataAvailable}`, M + 8, y + 2);
      y += 14;
    }

    if (y + 16 > H - 16) { y = startNewPage(T.tableOfContents); }
    setF(C.offWhite); doc.roundedRect(M, y - 4, CW, 14, 2, 2, "F");
    setF(C.primary); doc.rect(M, y - 4, 3, 14, "F");
    doc.setFontSize(14); setC(C.primary);
    doc.text(String(tocIndex).padStart(2, "0"), M + 6, y + 4);
    doc.setFontSize(10); setC(C.black);
    doc.text(T.monthlySummary, M + 20, y + 1);
    doc.setFontSize(7); setC(C.grey);
    doc.text("Overall performance across all platforms with traffic light status", M + 20, y + 7);
    doc.setFontSize(8); setC(C.grey);
    doc.text(`p.${estimatedPage}`, W - M - 6, y + 1, { align: "right" });
    y += 18;
    tocIndex++;

    if (upsellData && client.enable_upsell !== false) {
      if (y + 16 > H - 16) { y = startNewPage(T.tableOfContents); }
      setF(C.offWhite); doc.roundedRect(M, y - 4, CW, 14, 2, 2, "F");
      setF(C.primary); doc.rect(M, y - 4, 3, 14, "F");
      doc.setFontSize(14); setC(C.primary);
      doc.text(String(tocIndex).padStart(2, "0"), M + 6, y + 4);
      doc.setFontSize(10); setC(C.black);
      doc.text(`${T.noteFrom} ${orgName}`, M + 20, y + 1);
      doc.setFontSize(7); setC(C.grey);
      doc.text("A service recommendation based on your results", M + 20, y + 7);
      y += 18;
    }

    // "View Your Full Dashboard" button on TOC / executive summary page
    if (dashboardUrl) {
      y += 4;
      if (y + 18 > H - 16) { y = startNewPage(T.tableOfContents); }
      const btnW = 72;
      const btnH = 12;
      const btnX = (W - btnW) / 2;
      setF(C.primary); doc.roundedRect(btnX, y, btnW, btnH, 3, 3, "F");
      doc.setFontSize(9); setC(C.white); doc.setFont("helvetica", "bold");
      doc.text("View Your Full Dashboard", W / 2, y + 7.5, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.link(btnX, y, btnW, btnH, { url: dashboardUrl });
      y += btnH + 6;
    }

    for (const section of platformSections) {
      const isOnePage = ONE_PAGE_PLATFORMS.has(section.platform);
      let platformPageCount = 0;
      const maxPlatformPages = isOnePage ? 1 : 2;
      const hasPrev = section.hasPrevSnapshot;

      const platStatus = getPlatformStatus(section.platform, section.metrics, hasPrev ? section.prevMetrics : null);

      y = startNewPage(section.label, platStatus);
      platformPageCount++;
      pageToc.push({ title: section.label, page: pageCount });

      doc.setFontSize(8); setC(C.grey);
      const descLines = doc.splitTextToSize(`${section.label} tracks ${section.description}`, CW);
      doc.text(descLines, M, y);
      y += descLines.length * 3.5 + 3;
      setF(C.primary); doc.rect(M, y, 40, 1, "F"); y += 7;

      if (!hasPrev) {
        setF(C.amberLight); doc.roundedRect(M, y - 3, CW, 10, 2, 2, "F");
        doc.setFontSize(8); setC(C.amber);
        doc.text("This is your first month tracked for this platform — no comparison data available yet.", M + 4, y + 3);
        y += 12;
      }

      y = drawSectionLabel(T.performanceMetrics, y);

      const gridMetrics = section.enabledMetrics.filter(k => typeof section.metrics[k] === "number" && METRIC_LABELS[k]).slice(0, maxMetricCards);
      const colCount = 3;
      const cardW = (CW - (colCount - 1) * 4) / colCount;
      const cardH = hasPrev ? 28 : 22;
      let cardX = M;
      let cardsInRow = 0;

      for (const key of gridMetrics) {
        if (y + cardH > H - 16) {
          if (platformPageCount >= maxPlatformPages) break;
          y = startNewPage(section.label, platStatus);
          platformPageCount++;
          cardX = M; cardsInRow = 0;
        }

        const val = section.metrics[key];

        // Card background
        setF(C.cardBg); doc.roundedRect(cardX, y, cardW, cardH, 2, 2, "F");
        // Brand colour top border
        setF(C.primary); doc.rect(cardX, y, cardW, 0.7, "F");
        // Subtle card border
        setD(C.cardBorder); doc.setLineWidth(0.3);
        doc.roundedRect(cardX, y, cardW, cardH, 2, 2, "S");

        doc.setFontSize(6.5); setC(C.metricLabel);
        const labelText = (METRIC_LABELS[key] ?? key).toUpperCase();
        const maxLabelW = cardW - 12;
        const displayLabel = doc.getTextWidth(labelText) > maxLabelW
          ? labelText.substring(0, Math.floor(maxLabelW / doc.getTextWidth("A") * labelText.length)) + ".."
          : labelText;
        doc.text(displayLabel, cardX + 6, y + 8);

        doc.setFontSize(20); setC(C.metricValue);
        doc.text(formatVal(key, val), cardX + 6, y + 18);

        if (hasPrev) {
          const prevVal = section.prevMetrics[key];
          if (prevVal !== undefined && key in section.prevMetrics) {
            const change = calcChange(val, prevVal);
            const indicator = formatChangeIndicator(change.pct, INVERTED_METRICS.has(key));
            if (indicator.isPositive === true) {
              setC(C.green);
            } else if (indicator.isPositive === false) {
              setC(C.red);
            } else {
              setC(C.grey);
            }
            doc.setFontSize(7.5);
            doc.text(indicator.label, cardX + 6, y + 24);
            setC(C.metricValue);
          } else {
            doc.setFontSize(7.5); setC(C.grey);
            doc.text(T.newThisMonth, cardX + 6, y + 24);
          }
        }

        cardX += cardW + 4;
        cardsInRow++;
        if (cardsInRow >= colCount) {
          cardX = M; y += cardH + 4; cardsInRow = 0;
        }
      }
      if (cardsInRow > 0) y += cardH + 4;

      y += 8;

      const summaryText = platformSummaries[section.platform];
      if (summaryText && platformPageCount <= maxPlatformPages && client.enable_explanations !== false) {
        y = drawSectionLabel(T.whatThisMeans, y);

        doc.setFontSize(8.5);
        const summaryLines = doc.splitTextToSize(summaryText, CW - 16);
        const boxH = Math.min(summaryLines.length, 6) * 4 + 10;

        if (y + boxH > H - 16) {
          if (platformPageCount < maxPlatformPages) {
            y = startNewPage(section.label, platStatus);
            platformPageCount++;
          }
        }

        if (platformPageCount <= maxPlatformPages) {
          const boxTop = y;
          const finalLines = summaryLines.slice(0, 6);
          const actualBoxH = finalLines.length * 4 + 10;
          setF(C.secondaryLight); doc.roundedRect(M, boxTop, CW, actualBoxH, 3, 3, "F");
          setF(C.secondary); doc.rect(M, boxTop, 3, actualBoxH, "F");

          doc.setFontSize(8.5); setC(C.black);
          let sY = boxTop + 7;
          for (const line of finalLines) {
            doc.text(line, M + 8, sY);
            sY += 4;
          }
          y = boxTop + actualBoxH + 8;
        }
      }

      if (showComparisonTable && client.enable_mom_comparison !== false && hasPrev && gridMetrics.length > 0 && platformPageCount <= maxPlatformPages) {
        const pageUsedPct = (y - 14) / (H - 30);
        const needsNewPage = pageUsedPct > 0.55 && platformPageCount < maxPlatformPages;

        if (needsNewPage || y + 20 > H - 16) {
          if (platformPageCount < maxPlatformPages) {
            y = startNewPage(section.label, platStatus);
            platformPageCount++;
          }
        }

        if (platformPageCount <= maxPlatformPages) {
          y = drawSectionLabel(T.monthOnMonth, y);

          const colWidths = [CW * 0.30, CW * 0.22, CW * 0.22, CW * 0.26];
          const tableHeaders = ["Metric", currentLabel, previousLabel, T.change];

          // Table header row — brand primary background
          setF(C.primary); doc.roundedRect(M, y - 3.5, CW, 8, 1, 1, "F");
          doc.setFontSize(7); setC(C.white);
          let hx = M;
          for (let i = 0; i < tableHeaders.length; i++) {
            doc.text(tableHeaders[i].toUpperCase(), hx + 4, y + 1.5);
            hx += colWidths[i];
          }
          y += 8;

          const maxRows = maxTableRows;
          let rowIdx = 0;
          for (const key of gridMetrics) {
            if (rowIdx >= maxRows) break;
            if (y + 7 > H - 16) {
              if (platformPageCount >= maxPlatformPages) break;
              y = startNewPage(section.label, platStatus);
              platformPageCount++;
              setF(C.primary); doc.roundedRect(M, y - 3.5, CW, 8, 1, 1, "F");
              doc.setFontSize(7); setC(C.white);
              hx = M;
              for (let i = 0; i < tableHeaders.length; i++) {
                doc.text(tableHeaders[i].toUpperCase(), hx + 4, y + 1.5);
                hx += colWidths[i];
              }
              y += 8;
            }

            const val = section.metrics[key];
            const prevVal = section.prevMetrics[key];

            if (rowIdx % 2 === 0) {
              setF([249, 249, 249]); doc.rect(M, y - 3, CW, 7, "F");
            }

            doc.setFontSize(7.5);
            let rx = M;
            setC(C.black); doc.text(METRIC_LABELS[key]!, rx + 4, y + 1);
            rx += colWidths[0];
            doc.text(formatVal(key, val), rx + 4, y + 1);
            rx += colWidths[1];
            if (prevVal !== undefined && key in section.prevMetrics) {
              doc.text(formatVal(key, prevVal), rx + 4, y + 1);
            } else {
              setC(C.grey); doc.text("--", rx + 4, y + 1);
            }
            rx += colWidths[2];

            if (prevVal !== undefined && key in section.prevMetrics && prevVal !== 0) {
              const change = calcChange(val, prevVal);
              const indicator = formatChangeIndicator(change.pct, INVERTED_METRICS.has(key));
              if (indicator.isPositive === true) {
                setC(C.green);
              } else if (indicator.isPositive === false) {
                setC(C.red);
              } else {
                setC(C.grey);
              }
              doc.text(indicator.label, rx + 4, y + 1);
              setC(C.metricValue);
            } else if (prevVal !== undefined && key in section.prevMetrics) {
              setC(C.grey); doc.text("0.0%", rx + 4, y + 1);
            } else {
              setC(C.grey); doc.text("New", rx + 4, y + 1);
            }

            y += 7; rowIdx++;
          }
          y += 8;
        }
      } else if (!hasPrev) {
        if (y + 10 <= H - 16) {
          doc.setFontSize(8); setC(C.grey);
          doc.text("No previous month data available for comparison.", M, y);
          y += 8;
        }
      }

      if (maxTopPosts > 0 && section.topContent.length > 0 && platformPageCount <= maxPlatformPages) {
        const effectiveMaxPosts = Math.min(maxTopPosts, (y + 40 > H - 16 && platformPageCount >= maxPlatformPages) ? 3 : maxTopPosts);
        if (y + 20 > H - 16) {
          if (platformPageCount < maxPlatformPages) {
            y = startNewPage(section.label, platStatus);
            platformPageCount++;
          }
        }

        if (platformPageCount <= maxPlatformPages) {
          y = drawSectionLabel(T.topContent, y);

          const topItems = section.topContent.slice(0, effectiveMaxPosts) as Record<string, unknown>[];
          for (let idx = 0; idx < topItems.length; idx++) {
            const item = topItems[idx];
            if (y + 12 > H - 16) {
              if (platformPageCount >= maxPlatformPages) break;
            }

            setF(idx % 2 === 0 ? C.offWhite : C.white);
            doc.roundedRect(M, y - 3, CW, 12, 1.5, 1.5, "F");

            doc.setFontSize(8); setC(C.black);
            const postTitle = getPostCaption(item);
            const availableWidth = CW * 0.55;
            const postLines = doc.splitTextToSize(`${idx + 1}.  ${postTitle}`, availableWidth);
            doc.text(postLines[0], M + 4, y + 2);

            const details: string[] = [];
            if (item.spend !== undefined) details.push(`Spend: ${currSymbol}${Number(item.spend).toFixed(2)}`);
            if (item.impressions !== undefined) details.push(`Imp: ${Number(item.impressions).toLocaleString()}`);
            if (item.clicks !== undefined) details.push(`Clicks: ${Number(item.clicks).toLocaleString()}`);
            if (item.engagement !== undefined) details.push(`Eng: ${Number(item.engagement).toLocaleString()}`);
            if (item.views !== undefined) details.push(`Views: ${Number(item.views).toLocaleString()}`);
            if (item.likes !== undefined) details.push(`Likes: ${Number(item.likes).toLocaleString()}`);
            if (details.length > 0) {
              doc.setFontSize(6.5); setC(C.grey);
              doc.text(details.join("  |  "), M + 10, y + 7);
            }
            y += 14;
          }
          y += 2;
        }
      }

      // "View detailed metrics in your dashboard" link at bottom of platform section
      if (dashboardUrl && platformPageCount <= maxPlatformPages) {
        if (y + 10 <= H - 16) {
          const linkText = "View detailed metrics in your dashboard ->";
          doc.setFontSize(7.5); setC(C.primary);
          doc.text(linkText, M, y + 2);
          const linkW = doc.getTextWidth(linkText);
          doc.link(M, y - 1, linkW, 6, { url: dashboardUrl });
          y += 8;
        }
      }
    }

    y = startNewPage(T.monthlySummary);
    pageToc.push({ title: T.monthlySummary, page: pageCount });

    setF(C.primaryLight); doc.roundedRect(M, y - 3, CW, 30, 3, 3, "F");
    setF(C.primary); doc.rect(M, y - 3, 3, 30, "F");
    doc.setFontSize(9); setC(C.black);
    const summaryLines = doc.splitTextToSize(executiveSummary, CW - 16);
    let sumY = y + 3;
    for (const line of summaryLines.slice(0, 6)) {
      doc.text(line, M + 8, sumY);
      sumY += 4.5;
    }
    y += 34;

    y = drawSectionLabel(T.platformStatus, y);

    const summaryColWidths = [CW * 0.28, CW * 0.15, CW * 0.57];
    setF(C.primary); doc.roundedRect(M, y - 3.5, CW, 8, 1, 1, "F");
    doc.setFontSize(7); setC(C.white);
    doc.text(T.platform, M + 4, y + 1.5);
    doc.text(T.status, M + summaryColWidths[0] + 4, y + 1.5);
    doc.text(T.verdict, M + summaryColWidths[0] + summaryColWidths[1] + 4, y + 1.5);
    y += 8;

    for (let i = 0; i < platformSections.length; i++) {
      if (y + 9 > H - 16) y = startNewPage(T.monthlySummary);
      const section = platformSections[i];
      const status = getPlatformStatus(section.platform, section.metrics, section.hasPrevSnapshot ? section.prevMetrics : null);

      if (i % 2 === 0) {
        setF(C.tableAltRow); doc.rect(M, y - 3, CW, 9, "F");
      }

      doc.setFontSize(8); setC(C.black);
      doc.text(section.label, M + 4, y + 2);

      const bx = M + summaryColWidths[0] + 4;
      drawStatusBadge(bx, y + 1, status, 28);

      const summaryText = platformSummaries[section.platform] ?? "";
      const firstSentence = summaryText.split(/[.!?]/)[0] + ".";
      const verdictWords = firstSentence.split(/\s+/).slice(0, 15).join(" ");
      const verdict = verdictWords.endsWith(".") ? verdictWords : verdictWords + "...";
      doc.setFontSize(6.5); setC(C.grey);
      const vLines = doc.splitTextToSize(verdict, summaryColWidths[2] - 8);
      doc.text(vLines[0], M + summaryColWidths[0] + summaryColWidths[1] + 4, y + 2);

      y += 9;
    }
    y += 8;

    if (keyWins.length > 0) {
      y = drawSectionLabel(T.keyWins, y);

      for (const win of keyWins) {
        if (y + 12 > H - 16) { y = startNewPage(T.monthlySummary); }
        setF(C.greenLight); doc.roundedRect(M, y - 3, CW, 9, 2, 2, "F");
        setF(C.green); doc.rect(M, y - 3, 2.5, 9, "F");
        doc.setFontSize(8); setC(C.black);
        const winLines = doc.splitTextToSize(win, CW - 12);
        doc.text(winLines[0], M + 6, y + 2);
        y += 12;
      }
    } else {
      y = drawSectionLabel(T.keyWins, y);
      doc.setFontSize(8); setC(C.grey);
      doc.text("This is your first reporting month — we'll track improvements from here.", M + 6, y);
      y += 10;
    }
    y += 4;

    if (worthWatching.length > 0) {
      const worthWatchingHeight = worthWatching.length * 12 + 10;
      if (y + worthWatchingHeight > H - 16) {
        if (y + worthWatchingHeight > H - 6) {
          y = startNewPage(T.monthlySummary);
        }
      }

      y = drawSectionLabel(T.worthWatching, y);

      for (const item of worthWatching) {
        setF(C.amberLight); doc.roundedRect(M, y - 3, CW, 9, 2, 2, "F");
        setF(C.amber); doc.rect(M, y - 3, 2.5, 9, "F");
        doc.setFontSize(8); setC(C.black);
        const watchLines = doc.splitTextToSize(item, CW - 12);
        doc.text(watchLines[0], M + 6, y + 2);
        y += 12;
      }
    }

    if (upsellData && client.enable_upsell !== false) {
      y = startNewPage(`${T.noteFrom} ${orgName}`);
      pageToc.push({ title: `${T.noteFrom} ${orgName}`, page: pageCount });

      setF(C.primary); doc.rect(M, y - 2, 40, 1.5, "F"); y += 6;

      doc.setFontSize(14); setC(C.black);
      const headlineLines = doc.splitTextToSize(upsellData.headline, CW);
      for (const line of headlineLines) {
        doc.text(line, M, y); y += 7;
      }
      y += 6;

      doc.setFontSize(9); setC(C.black);
      y = wrapText(upsellData.body_content, M, y, CW, 4.5);
      y += 8;

      if (upsellData.comparison_data && Array.isArray(upsellData.comparison_data)) {
        const compData = upsellData.comparison_data as { label: string; option_a: string; option_b: string }[];
        if (compData.length > 0) {
          y = drawSectionLabel("Comparison", y);

          const compColW = [CW * 0.34, CW * 0.33, CW * 0.33];
          setF(C.primary); doc.roundedRect(M, y - 3.5, CW, 8, 1, 1, "F");
          doc.setFontSize(7.5); setC(C.white);
          doc.text("FEATURE", M + 4, y + 1.5);
          doc.text(compData[0]?.option_a ? "OPTION A" : "", M + compColW[0] + 4, y + 1.5);
          doc.text(compData[0]?.option_b ? "OPTION B" : "", M + compColW[0] + compColW[1] + 4, y + 1.5);
          y += 8;

          for (let i = 0; i < compData.length; i++) {
            if (y + 7 > H - 16) y = startNewPage(`${T.noteFrom} ${orgName}`);
            if (i % 2 === 0) { setF(C.tableAltRow); doc.rect(M, y - 3, CW, 7, "F"); }
            doc.setFontSize(7.5); setC(C.black);
            doc.text(compData[i].label, M + 4, y + 1);
            doc.text(compData[i].option_a ?? "", M + compColW[0] + 4, y + 1);
            doc.text(compData[i].option_b ?? "", M + compColW[0] + compColW[1] + 4, y + 1);
            y += 7;
          }
          y += 6;
        }
      }

      y += 4;
      setF(C.primaryLight); doc.roundedRect(M, y - 3, CW, 14, 3, 3, "F");
      setF(C.primary); doc.rect(M, y - 3, 3, 14, "F");
      doc.setFontSize(9); setC(C.primary);
      const ctaText = orgPhone
        ? `Interested? Reply to this email or call us at ${orgPhone}.`
        : T.interested;
      doc.text(ctaText, M + 8, y + 4);
    }

    // End page — dark background with brand accents
    if (pageCount > 0) doc.addPage();
    pageCount++;

    // Dark background
    setF(C.coverDark); doc.rect(0, 0, W, H, 'F');

    // Top accent bar
    setF(C.primary); doc.rect(0, 0, W, 4, 'F');

    // Bottom footer bar
    setF(C.coverDarkPanel); doc.rect(0, H - 20, W, 20, 'F');

    const clientFirstName = client.full_name.split(" ")[0];

    // "READY TO GROW?" label in brand colour
    setC(C.primary);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(T.readyToGrow, 14, 35);

    // "THANK YOU,"
    doc.setFontSize(28); doc.setFont('helvetica', 'bold');
    setC(C.white);
    doc.text(T.thankYou, 14, 52);

    // Client first name in brand colour
    setC(C.primary);
    doc.text((clientFirstName + '.').toUpperCase(), 14, 68);
    doc.setFont('helvetica', 'normal');

    // Body text
    setC(C.textFaint);
    doc.setFontSize(8.5);
    const contactParts: string[] = [];
    if (orgEmail) contactParts.push(`email ${orgEmail}`);
    if (orgPhone) contactParts.push(`call ${orgPhone}`);
    const contactLine = contactParts.length > 0
      ? ` Questions about this report? ${contactParts.join(" or ")}.`
      : "";
    const dashboardLine = dashboardUrl ? " Visit your dashboard anytime for the full picture." : "";
    const endText = `This report gives you a quick snapshot of your marketing performance.${contactLine}${dashboardLine}`;
    const endLines = doc.splitTextToSize(endText, 110);
    doc.text(endLines, 14, 85);

    // Logo in footer if available
    if (logoBase64) {
      try {
        doc.addImage(`data:image/${logoExt.toLowerCase()};base64,${logoBase64}`, logoExt, 14, H - 15, 30, 9, undefined, 'FAST');
      } catch { /* fallback: no logo in footer */ }
    }

    // Org details in footer
    setC(C.grey);
    doc.setFontSize(7);
    const endFooterParts: string[] = [];
    if (orgEmail) endFooterParts.push(orgEmail);
    if (orgWebsite) endFooterParts.push(orgWebsite);
    if (endFooterParts.length > 0) {
      doc.text(endFooterParts.join(" | "), W - 14, H - 12, { align: "right" });
    }
    doc.text(`${orgName} | ${periodLabel}`, W - 14, H - 7, { align: "right" });

    const pdfBuffer = doc.output("arraybuffer");
    const pdfUint8 = new Uint8Array(pdfBuffer);

    const storagePath = isCustomRange
      ? `${client_id}/${date_from}_${date_to}.pdf`
      : `${client_id}/${report_year}-${String(report_month).padStart(2, "0")}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("reports")
      .upload(storagePath, pdfUint8, { contentType: "application/pdf", upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      // Mark report as failed
      if (earlyReportId) {
        await supabase.from("reports").update({ status: "failed" as const }).eq("id", earlyReportId);
      }
      return new Response(JSON.stringify({ error: "Failed to upload PDF" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update the report record to success
    const reportData = {
      status: "success" as const,
      pdf_storage_path: storagePath,
      ai_executive_summary: executiveSummary,
      ai_insights: JSON.stringify(platformSummaries),
      ai_upsell_recommendations: upsellData ? upsellData.body_content : null,
      generated_at: new Date().toISOString(),
    };

    if (earlyReportId) {
      await supabase.from("reports").update(reportData).eq("id", earlyReportId);
    }

    // ── Enforce 12-report cap per client ──
    try {
      const { data: allReports } = await supabase
        .from("reports")
        .select("id, pdf_storage_path")
        .eq("client_id", client_id)
        .order("report_year", { ascending: false })
        .order("report_month", { ascending: false });

      if (allReports && allReports.length > 12) {
        const reportsToDelete = allReports.slice(12);
        const pdfPaths = reportsToDelete
          .map(r => r.pdf_storage_path)
          .filter(Boolean) as string[];

        if (pdfPaths.length > 0) {
          await supabase.storage.from("reports").remove(pdfPaths);
        }

        const idsToDelete = reportsToDelete.map(r => r.id);
        await supabase.from("reports").delete().in("id", idsToDelete);
        console.log(`Cleaned up ${idsToDelete.length} old reports for client ${client_id}`);
      }
    } catch (cleanupErr) {
      console.error("Report cleanup error (non-fatal):", cleanupErr);
    }

    await supabase.from("report_logs").insert({
      client_id, report_id: earlyReportId ?? null, status: "success", org_id: client.org_id,
    });

    return new Response(JSON.stringify({
      success: true, pdf_path: storagePath,
      message: `Report generated for ${client.company_name} - ${periodLabel}`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("Report generation error:", err);

    // Try to mark the report as failed
    try {
      if (earlyReportId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const sb = createClient(supabaseUrl, serviceRoleKey);
        await sb.from("reports")
          .update({ status: "failed" as const })
          .eq("id", earlyReportId);
      }
    } catch (_) {
      // Best effort
    }

    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
