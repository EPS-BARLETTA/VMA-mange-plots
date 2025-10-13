VMA-mange-plots — UI tweaks (non destructifs)

Ce paquet apporte uniquement des améliorations visuelles sans modifier vos fonctions.
Il ajoute 2 fichiers à inclure + 1 page de "Fiche de sécurité".

FICHIERS
- theme.css        → palette, boutons, cartes, "pills" / badges, couleurs Coureur A/B
- ui-tweaks.js     → petites améliorations DOM (réorganisation des boutons d’accueil, renommage "Coureur A/B",
                     masquage de l’entête inutile, gros prénom, pills pour le temps restant, teinte des +/- )
- safety.html      → fiche de sécurité aérée et colorée

INSTALLATION (2 lignes à ajouter par page)
1) Placez theme.css et ui-tweaks.js à la racine du projet (à côté de index.html).
2) Ouvrez **index.html**, **setup.html**, **run.html**, **recap.html** et ajoutez :
   <link rel="stylesheet" href="./theme.css" />
   <script defer src="./ui-tweaks.js"></script>

DÉTAILS DES AJUSTEMENTS
- Page d’accueil (index.html) :
  • Bouton "Démarrer" bleu sous le titre (plein largeur). 
  • Boutons "Aide" (violet clair) et "Fiche de sécurité" (orange clair) juste en dessous.
  • Mise en page centrée et très lisible sur iPad.

- Paramétrage (setup.html) :
  • "Élève A/B" → "Coureur A/B" (texte uniquement).
  • Bloc de saisie A en **bleu clair**, B en **vert clair** (fond des champs également).

- Course (run.html) :
  • Masque "Blocs 1:30 • Couleurs alternées" si présent.
  • Affiche uniquement le **prénom** en gros au-dessus du chrono.
  • Sous le chrono : insère une barre "métriques" quand les données sont disponibles (VMA, % VMA, calcul vitesse,
    rappel de durée de bloc). Rien n’est cassé si les clés locales diffèrent (fallback gracieux).
  • Temps **restant par bloc** mis en évidence sous forme de **pill** (vert par défaut).
  • Boutons **+** teints : Coureur A en vert clair, Coureur B en bleu clair ; **-** en rouge clair.

- Bilan (recap.html) :
  • Teinte de fond adaptée aux couleurs des coureurs (bleu clair / vert clair).

MENTIONS
- Aucune fonction métier ni QR code n’est modifié.
- Toutes les modifications sont DOM/CSS "au-dessus" de l’existant : si un élément n’est pas trouvé,
  le script n’applique rien (pas d’erreur bloquante).
- La "Fiche de sécurité" reprend les points clés fournis par vous (document Word).

Astuce : si vous souhaitez **remonter** un peu l’alignement des éléments sur iPad,
vous pouvez ajouter la classe `centered-page` au <body> d’une page.